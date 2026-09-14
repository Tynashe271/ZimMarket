import 'dotenv/config';
import { AccountType, BusinessRole, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma=new PrismaClient();
async function user(phone:string,email:string,accountType:AccountType,password:string){return prisma.user.upsert({where:{phone},update:{email,accountType,passwordHash:await argon2.hash(password),phoneVerifiedAt:new Date(),emailVerifiedAt:new Date()},create:{phone,email,accountType,passwordHash:await argon2.hash(password),phoneVerifiedAt:new Date(),emailVerifiedAt:new Date()}})}
async function main(){
 const password=process.env.DEMO_ADMIN_PASSWORD??'ChangeMe123!';
 await user(process.env.DEMO_ADMIN_PHONE??'+263770000001',process.env.DEMO_ADMIN_EMAIL??'admin@zimmarket.local',AccountType.ADMIN,password);
 const owner=await user('+263770000002','owner@zimmarket.local',AccountType.BUSINESS,password);
 await user('+263770000003','customer@zimmarket.local',AccountType.CUSTOMER,password);
 const business=await prisma.business.upsert({where:{slug:'gadgethub-demo'},update:{status:'ACTIVE',industry:'Electronics'},create:{name:'GadgetHub Demo',slug:'gadgethub-demo',status:'ACTIVE',industry:'Electronics',communityTags:['Zimbabwean-made','Small business'],members:{create:{userId:owner.id,role:BusinessRole.OWNER}},subscription:{create:{plan:'PREMIUM',status:'ACTIVE'}},supportedCurrencies:{create:[{currency:'USD'},{currency:'ZiG'}]}}});
 const branch=await prisma.branch.upsert({where:{businessId_name:{businessId:business.id,name:'Harare CBD'}},update:{},create:{businessId:business.id,name:'Harare CBD',province:'Harare',city:'Harare',suburb:'CBD',deliveryAreas:['Harare','Chitungwiza'],operatingHours:{mon_fri:'08:00-17:00',sat:'08:00-13:00'}}});
 const product=await prisma.product.upsert({where:{businessId_slug:{businessId:business.id,slug:'demo-laptop'}},update:{status:'ACTIVE',stockQuantity:20},create:{businessId:business.id,name:'Demo Laptop',slug:'demo-laptop',description:'Seeded product for local API testing',price:499,costPrice:350,stockQuantity:20,status:'ACTIVE',prices:{create:[{currency:'USD',amount:499},{currency:'ZiG',amount:7000}]}}});
 await prisma.branchInventory.upsert({where:{branchId_productId:{branchId:branch.id,productId:product.id}},update:{quantity:20,availability:'AVAILABLE'},create:{branchId:branch.id,productId:product.id,quantity:20,availability:'AVAILABLE',lowStockAt:5}});
 const existing=await prisma.service.findFirst({where:{businessId:business.id,name:'Laptop Repair'}});if(!existing)await prisma.service.create({data:{businessId:business.id,name:'Laptop Repair',category:'Electronics',description:'Demo repair booking',durationMinutes:60,price:25,currency:'USD',active:true}});
 const existingFiscalisation=await prisma.businessFiscalisation.findFirst({where:{businessId:business.id}});if(!existingFiscalisation)await prisma.businessFiscalisation.create({data:{businessId:business.id,registeredBusinessName:'GadgetHub Demo',tradingName:'GadgetHub Demo',tin:'DEMO123456',taxpayerActive:true,vatNumber:null,taxClearanceCertificateNumber:'DEMO-CERT-001',taxClearanceIssuedAt:new Date(),taxClearanceExpiresAt:new Date(Date.now()+365*24*60*60*1000),taxClearanceDocumentKey:'demo-doc',method:'FISCALISED_POS',deviceIdentifier:'DEMO-POS-001',deviceModel:'Demo Model',deviceSerialNumber:'DEMO-SN-001',virtualDeviceIdentifier:null,approvedSupplierOrIntegrator:'Demo Supplier',zimraRegistrationEvidenceKey:'demo-evidence',branchInformation:{},sampleFiscalReceiptKey:'demo-receipt',receiptVerificationCode:'DEMO-123',authorisedRepresentative:'Demo Owner',deviceActive:true,deviceRegistered:true,status:'COMPLIANT',receiptVerifiedAt:new Date()}});
 console.log('Demo data ready: admin@zimmarket.local, owner@zimmarket.local, customer@zimmarket.local');
}
main().finally(()=>prisma.$disconnect());
