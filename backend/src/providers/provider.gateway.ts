import{BadRequestException,Injectable,NotFoundException,UnauthorizedException}from'@nestjs/common';import{ConfigService}from'@nestjs/config';import{Prisma}from'@prisma/client';import{createHash,createHmac,timingSafeEqual}from'crypto';import{mkdir,readFile,writeFile}from'fs/promises';import{dirname,extname,isAbsolute,resolve,sep}from'path';import{PrismaService}from'../prisma/prisma.service';import{AfricasTalkingProvider}from'./africastalking.provider';import{TwilioProvider}from'./twilio.provider';import{SmsProvider,SmsSendResult}from'./sms-provider.interface';import{ResendProvider}from'./resend.provider';import{EmailProvider,EmailSendResult}from'./email-provider.interface';
export type MessageChannel='SMS'|'EMAIL'|'WHATSAPP';
@Injectable()export class ProviderGateway{
 private readonly smsProviders:Record<string,SmsProvider>;
 private readonly emailProviders:Record<string,EmailProvider>;
 constructor(private readonly config:ConfigService,private readonly prisma:PrismaService,africasTalking:AfricasTalkingProvider,twilio:TwilioProvider,resend:ResendProvider){this.smsProviders={africastalking:africasTalking,twilio};this.emailProviders={resend}}
 async send(channel:MessageChannel,to:string,template:string,data:Record<string,unknown>){
  const provider=this.config.get(`${channel}_PROVIDER`,'development');
  const smsProvider=channel==='SMS'?this.smsProviders[provider]:undefined;
  const emailProvider=channel==='EMAIL'?this.emailProviders[provider]:undefined;
  if(smsProvider||emailProvider){
   let result:SmsSendResult|EmailSendResult;
   if(smsProvider){
    result=await smsProvider.sendSms(to,this.renderSmsBody(template,data));
   }else{
    const unsubscribeUrl=template!=='verification'&&typeof data.userId==='string'?this.unsubscribeUrl(data.userId):undefined;
    const{subject,html,text}=this.renderEmailBody(template,data,unsubscribeUrl);
    result=await emailProvider!.sendEmail(to,subject,html,text);
   }
   const message=await this.prisma.notificationOutbox.create({data:{channel,recipient:to,template,payload:this.json(data),status:result.success?'SENT':'FAILED'}});
   await this.event(provider,`${channel}.send`,result.success?'SUCCESS':'FAILED',{messageId:message.id,providerMessageId:result.messageId,error:result.error});
   if(!result.success)throw new BadRequestException(result.error||`${channel} provider could not send the message`);
   return{provider,accepted:true,messageId:message.id,to:channel==='EMAIL'?this.maskEmail(to):`***${to.slice(-4)}`,template};
  }
  if(provider!=='development')throw new BadRequestException(`${channel} provider credentials are not configured`);
  const message=await this.prisma.notificationOutbox.create({data:{channel,recipient:to,template,payload:this.json(data)}});await this.event(provider,`${channel}.send`,'SUCCESS',{messageId:message.id});return{provider,accepted:true,messageId:message.id,to:channel==='EMAIL'?this.maskEmail(to):`***${to.slice(-4)}`,template}}
 private renderSmsBody(template:string,data:Record<string,unknown>){if(template==='verification'&&typeof data.code==='string'){const purpose=data.type==='PASSWORD_RESET'?'password reset':data.type==='MFA'?'sign-in':'verification';return`Your ZimMarket ${purpose} code is ${data.code}. It expires in 10 minutes.`}if(template==='new-message')return'You have a new message on ZimMarket. Open the app to reply.';return`ZimMarket: ${template}`}
 private renderEmailBody(template:string,data:Record<string,unknown>,unsubscribeUrl?:string){
  const footer=unsubscribeUrl?`<p style="font-size:12px;color:#667">You're receiving this because you have a ZimMarket account. <a href="${unsubscribeUrl}">Unsubscribe from these emails</a>.</p>`:'';
  if(template==='verification'&&typeof data.code==='string'){const purpose=data.type==='PASSWORD_RESET'?'password reset':data.type==='MFA'?'sign-in':'verification';const text=`Your ZimMarket ${purpose} code is ${data.code}. It expires in 10 minutes.`;return{subject:`Your ZimMarket ${purpose} code`,html:`<p>${text}</p>`,text}}
  if(template==='opportunity'){const category=typeof data.category==='string'?data.category:'marketplace';const text=`A new opportunity in the "${category}" category is available on ZimMarket.`;return{subject:'A new opportunity matches your interests',html:`<p>${text}</p>${footer}`,text}}
  if(template==='product-alert'){const text='A product you saved on ZimMarket has an update.';return{subject:'Update on a product you saved',html:`<p>${text}</p>${footer}`,text}}
  if(template==='new-message'){const text='You have a new message on ZimMarket. Open the app to view and reply.';return{subject:'New message on ZimMarket',html:`<p>${text}</p>${footer}`,text}}
  const text=`ZimMarket: ${template}`;return{subject:text,html:`<p>${text}</p>${footer}`,text}}
 unsubscribeUrl(userId:string){const base=this.config.get('APP_PUBLIC_URL','http://localhost:3001');return`${base}/unsubscribe?userId=${encodeURIComponent(userId)}&signature=${this.unsubscribeSignature(userId)}`}
 async unsubscribeEmail(userId:string,signature:string){
  if(!userId||!signature)throw new BadRequestException('userId and signature are required');
  const expected=Buffer.from(this.unsubscribeSignature(userId)),actual=Buffer.from(signature);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new UnauthorizedException('Invalid unsubscribe link');
  // The verified signature is per-user proof, equivalent to being authenticated
  // as this one user for this one operation -- scope to self rather than bypass.
  const next=await this.prisma.withContext({userId},async tx=>{
   const user=await tx.user.findUniqueOrThrow({where:{id:userId},select:{notificationPreference:true}});
   const next=user.notificationPreference==='BOTH'?'SMS':user.notificationPreference==='EMAIL'?'NONE':user.notificationPreference;
   if(next!==user.notificationPreference)await tx.user.update({where:{id:userId},data:{notificationPreference:next}});
   return next;
  });
  return{unsubscribed:true,notificationPreference:next}}
 private unsubscribeSignature(userId:string){return createHmac('sha256',this.config.getOrThrow('STORAGE_SIGNING_SECRET')).update(`unsubscribe:${userId}`).digest('hex')}
 private maskEmail(email:string){const[name,domain]=email.split('@');return domain?`${name.slice(0,2)}***@${domain}`:'***'}
 async scan(storageKey:string,mimeType:string){const blocked=['.exe','.dll','.bat','.cmd','.ps1','.com','.scr'];const clean=!blocked.includes(extname(storageKey).toLowerCase())&&!mimeType.includes('x-msdownload');return{storageKey,mimeType,clean,engine:this.config.get('MALWARE_SCANNER','development')}}
 async scanBuffer(storageKey:string,mimeType:string,buffer:Buffer){const metadata=await this.scan(storageKey,mimeType);const eicar=buffer.toString('utf8').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');return{...metadata,clean:metadata.clean&&!eicar,sha256:createHash('sha256').update(buffer).digest('hex')}}
 signedUpload(storageKey:string,mimeType:string,expiresSeconds=900){return this.signed('upload',storageKey,mimeType,expiresSeconds)}
 signedDownload(storageKey:string,expiresSeconds=300){return this.signed('download',storageKey,'',expiresSeconds)}
 async store(key:string,mime:string,expires:number,signature:string,buffer:Buffer){this.verify('upload',key,mime,expires,signature);const scan=await this.scanBuffer(key,mime,buffer);if(!scan.clean)throw new BadRequestException('File failed malware scan');const path=this.path(key);await mkdir(dirname(path),{recursive:true});await writeFile(path,buffer,{flag:'wx'}).catch(async error=>{if((error as NodeJS.ErrnoException).code==='EEXIST')await writeFile(path,buffer);else throw error});await this.event('local-storage','upload','SUCCESS',{key,size:buffer.length,sha256:scan.sha256});return{key,size:buffer.length,mimeType:mime,sha256:scan.sha256}}
 async load(key:string,expires:number,signature:string){this.verify('download',key,'',expires,signature);try{const data=await readFile(this.path(key));await this.event('local-storage','download','SUCCESS',{key,size:data.length});return data}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new NotFoundException('File not found');throw error}}
 async geocode(address:string,city:string){const digest=createHash('sha256').update(`${address}|${city}`).digest();const latitude=-22+(digest.readUInt16BE(0)/65535)*7;const longitude=25+(digest.readUInt16BE(2)/65535)*8;return{provider:this.config.get('MAPS_PROVIDER','development'),address,city,latitude:Number(latitude.toFixed(7)),longitude:Number(longitude.toFixed(7)),demoCoordinates:true}}
 async exportAccounting(format:'CSV'|'JSON',payload:unknown){await this.event(this.config.get('ACCOUNTING_PROVIDER','internal'),'accounting.export','SUCCESS',{format});return{format,payload,provider:this.config.get('ACCOUNTING_PROVIDER','internal')}}
 private signed(action:string,key:string,mime:string,seconds:number){this.validateKey(key);const expires=Math.floor(Date.now()/1000)+seconds;const signature=this.signature(action,key,mime,expires);const base=this.config.get('API_PUBLIC_URL','http://localhost:3000/api/v1');return{action,key,mimeType:mime,expires,signature,url:`${base}/demo/storage/${action}?key=${encodeURIComponent(key)}&mime=${encodeURIComponent(mime)}&expires=${expires}&signature=${signature}`}}
 private verify(action:string,key:string,mime:string,expires:number,signature:string){this.validateKey(key);if(expires<Math.floor(Date.now()/1000))throw new UnauthorizedException('Storage operation expired');const expected=Buffer.from(this.signature(action,key,mime,expires)),actual=Buffer.from(signature);if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new UnauthorizedException('Invalid storage signature')}
 private signature(action:string,key:string,mime:string,expires:number){return createHmac('sha256',this.config.getOrThrow('STORAGE_SIGNING_SECRET')).update(`${action}:${key}:${mime}:${expires}`).digest('hex')}
 private path(key:string){const root=resolve(this.config.get('LOCAL_STORAGE_PATH','.data/storage'));const target=resolve(root,key);if(target!==root&&!target.startsWith(`${root}${sep}`))throw new BadRequestException('Invalid storage path');return target}
 private validateKey(key:string){if(!key||isAbsolute(key)||key.includes('..')||!/^[-a-zA-Z0-9_./]+$/.test(key))throw new BadRequestException('Invalid storage key')}
 private async event(provider:string,operation:string,status:string,metadata:Record<string,unknown>){await this.prisma.providerEvent.create({data:{provider,operation,status,metadata:this.json(metadata)}})}private json(value:unknown){return JSON.parse(JSON.stringify(value))as Prisma.InputJsonValue}
}
