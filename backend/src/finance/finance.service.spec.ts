import{BadRequestException,UnauthorizedException}from'@nestjs/common';import{FinanceService}from'./finance.service';
function validOrder(){return{id:'11111111-1111-4111-8111-111111111111',status:'PENDING',total:10,currency:'USD',businessId:'b1',customer:{email:'buyer@example.com'},business:{status:'ACTIVE',fiscalisation:{status:'COMPLIANT',taxpayerActive:true,deviceActive:true,receiptVerifiedAt:new Date(),taxClearanceExpiresAt:new Date(Date.now()+86400000)}}}}
describe('Financial webhooks',()=>{it('rejects an invalid refund signature before database access',async()=>{const prisma={refundRequest:{findFirst:jest.fn()}};const config={getOrThrow:jest.fn().mockReturnValue('secret')};const service=new FinanceService(prisma as never,config as never,{} as never);await expect(service.completeRefund('invalid',{refundId:'00000000-0000-4000-8000-000000000000',providerRef:'ref'})).rejects.toBeInstanceOf(UnauthorizedException);expect(prisma.refundRequest.findFirst).not.toHaveBeenCalled()})});
describe('Paynow payment initiation',()=>{
  function setup(paynowResult:unknown){
    const order=validOrder();
    const prisma={order:{findFirst:jest.fn().mockResolvedValue(order)},payment:{upsert:jest.fn().mockResolvedValue({id:'p1',status:'PENDING'}),update:jest.fn().mockResolvedValue({})}};
    const config={get:jest.fn((key:string,fallback?:string)=>key==='PAYMENT_PROVIDER'?'paynow':fallback),getOrThrow:jest.fn((key:string)=>key==='APP_PUBLIC_URL'?'https://app.zimmarket.local':'https://api.zimmarket.local')};
    const paynow={initiateWebCheckout:jest.fn().mockResolvedValue(paynowResult)};
    return{service:new FinanceService(prisma as never,config as never,paynow as never),prisma,paynow};
  }
  it('returns a real checkout url when Paynow accepts the transaction',async()=>{
    const{service,prisma}=setup({success:true,browserUrl:'https://paynow.co.zw/pay/abc',pollUrl:'https://paynow.co.zw/poll/abc'});
    const result=await service.initiatePayment('u1','CUSTOMER','o1','ECOCASH','idem-key-12345');
    expect(result.checkoutUrl).toBe('https://paynow.co.zw/pay/abc');
    expect(result.requiresDemoConfirmation).toBe(false);
    expect(prisma.payment.update).toHaveBeenCalledWith({where:{id:'p1'},data:{providerCheckoutRef:'https://paynow.co.zw/poll/abc'}});
  });
  it('rejects the payment when Paynow refuses the transaction',async()=>{
    const{service}=setup({success:false,error:'Invalid integration id'});
    await expect(service.initiatePayment('u1','CUSTOMER','o1','ECOCASH','idem-key-12345')).rejects.toBeInstanceOf(BadRequestException);
  });
});
describe('Paynow result callback',()=>{
  it('finalizes the payment when Paynow confirms it was paid',async()=>{
    const payment={id:'p1',status:'PENDING',idempotencyKey:'idem-key-12345',amount:10,currency:'USD',provider:'ECOCASH',orderId:'o1',order:{id:'o1',businessId:'b1',invoice:null,customer:{id:'c1',fullName:'Buyer',email:'buyer@example.com',phone:null},items:[],recipient:null,business:{id:'b1',name:'Shop'}}};
    const tx={payment:{update:jest.fn().mockResolvedValue({...payment,status:'SUCCEEDED'})},order:{update:jest.fn()},invoice:{update:jest.fn()},notificationOutbox:{create:jest.fn()},ledgerEntry:{createMany:jest.fn()}};
    const prisma={payment:{findUnique:jest.fn().mockResolvedValue(payment)},$transaction:jest.fn((fn:(tx:unknown)=>unknown)=>fn(tx))};
    const paynow={verifyResultCallback:jest.fn().mockReturnValue({success:true,reference:'idem-key-12345',paynowReference:'PN-9',status:'paid',paid:true,failed:false})};
    const service=new FinanceService(prisma as never,{} as never,paynow as never);
    const result=await service.paynowResultCallback({reference:'idem-key-12345',status:'Paid',hash:'x'});
    expect((result as{status:string}).status).toBe('SUCCEEDED');
    expect(tx.payment.update).toHaveBeenCalledWith({where:{id:'p1'},data:{providerRef:'PN-9',status:'SUCCEEDED'}});
  });
  it('rejects a callback with an invalid signature before touching the database',async()=>{
    const prisma={payment:{findUnique:jest.fn()}};
    const paynow={verifyResultCallback:jest.fn().mockReturnValue({success:false,paid:false,failed:false,error:'Invalid Paynow callback signature'})};
    const service=new FinanceService(prisma as never,{} as never,paynow as never);
    await expect(service.paynowResultCallback({hash:'bad'})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });
});
