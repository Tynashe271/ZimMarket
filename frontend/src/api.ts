export type AccountType = 'CUSTOMER' | 'BUSINESS' | 'COURIER' | 'ADMIN';

export interface User { id: string; email?: string; phone: string; accountType: AccountType; fullName?: string; city?: string; province?: string; suburb?: string; deliveryAddresses?: unknown; notificationPreference?: string; emailVerifiedAt?: string; phoneVerifiedAt?: string; policyVersion?: string; policyAcceptedAt?: string }
export interface Session { user: User; accessToken: string; refreshToken: string; sessionId: string }
export interface Branch { id: string; name: string; city: string; province: string; suburb?: string; deliveryAreas: string[]; operatingHours?:Record<string,string> }
export interface Business { id: string; name: string; slug: string; industry?: string; communityTags: string[]; verificationLevel: string; branches: Branch[] }
export interface Product { id: string; name: string; slug: string; description?: string; price: number | string; stockQuantity?:number; status?:string; category?:string; updatedAt?:string; business: { id?:string; name: string; slug: string } }
export interface Ad { id: string; title: string; endsAt?: string; product?: Product; business?: { name:string; slug:string } }
export interface MarketplaceService { id: string; name: string; category: string; description?: string; durationMinutes: number; price?: number | string; currency?: string; business: { name: string; slug: string } }
export interface AssistantReply { reply: string; mode: 'ai' | 'local' }
export interface Order { id: string; status: string; total: number | string; currency: string; createdAt: string; items: { id: string; productName: string; quantity: number; unitPrice: number | string }[] }
export interface BusinessMember { id:string; userId:string; role:string; user?:Pick<User,'id'|'fullName'|'phone'|'email'>; branches?:{branchId:string;branch?:{id:string;name:string}}[] }
export interface Fiscalisation { tin:string; method:'PHYSICAL_DEVICE'|'FISCALISED_POS'|'VIRTUAL_DEVICE'|'FDMS_API'; deviceIdentifier:string; taxClearanceCertificateNumber:string; taxClearanceExpiresAt:string; status:string; taxpayerActive:boolean; deviceActive:boolean; deviceRegistered:boolean; receiptVerifiedAt?:string; rejectionReason?:string }
export interface ManagedBusiness extends Business { status: string; settings?:Record<string,unknown>; fiscalisation?:Fiscalisation; members: BusinessMember[] }
export interface Shop extends Business { products: Product[]; services?:MarketplaceService[]; ads?:Ad[]; rating?:{average:number|null;count:number}; reviews?:{id:string;rating:number;comment?:string;createdAt:string;customer:{fullName?:string}}[] }
export interface ActiveSession { id:string; deviceName?:string; ipAddress?:string; userAgent?:string; createdAt:string; expiresAt:string }
export interface CustomerWorkspace { bookings:any[]; conversations:any[]; follows:any[]; reservations:any[]; tickets:any[]; reports:any[]; refunds:any[]; activity:any[]; notifications:any[] }
export const ZIMBABWE_PAYMENT_METHODS=[['ECOCASH','EcoCash'],['ONEMONEY','OneMoney'],['INNBUCKS','InnBucks'],['OMARI',"O'mari"],['TELECASH','Telecash'],['ZIMSWITCH','Zimswitch card'],['VISA_MASTERCARD','Visa / Mastercard'],['ZIPIT_BANK_TRANSFER','ZIPIT'],['BANK_TRANSFER','Bank transfer / RTGS'],['CASH_ON_DELIVERY','Cash on delivery'],['CASH_ON_COLLECTION','Cash on collection']] as const;

const API_ROOT = `${(process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')}/api/v1`;
const SESSION_KEY = 'zimmarket.session';

export function savedSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null; } catch { return null; }
}

export function saveSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return body as T;
}

export const api = {
  health: () => request<{ status: string; timestamp: string }>('/health'),
  businesses: () => request<Business[]>('/public/businesses'),
  shop: (slug: string, token: string) => request<Shop>(`/public/businesses/${encodeURIComponent(slug)}`,{},token),
  ads: () => request<Ad[]>('/public/ads'),
  services: () => request<MarketplaceService[]>('/public/services'),
  products: (token: string) => request<Product[]>('/storefront/products', {}, token),
  publicProducts: () => request<Product[]>('/public/products'),
  login: (identifier: string, password: string) => request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  adminLogin: (identifier:string,password:string) => request<Session>('/auth/admin/login',{method:'POST',body:JSON.stringify({identifier,password})}),
  requestVerification: (token: string, type: 'EMAIL'|'PHONE'|'MFA') => request<{ accepted: boolean; developmentCode?: string }>('/auth/verification/request', { method: 'POST', body: JSON.stringify({ type }) }, token),
  confirmVerification: (token: string, type: 'EMAIL'|'PHONE'|'MFA', code: string) => request<{ verified: boolean }>('/auth/verification/confirm', { method: 'POST', body: JSON.stringify({ type, code }) }, token),
  requestPasswordReset: (identifier: string) => request<{ accepted: boolean; developmentCode?: string }>('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ identifier }) }),
  confirmPasswordReset: (identifier: string, code: string, newPassword: string) => request<{ reset: boolean }>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ identifier, code, newPassword }) }),
  profile: (token:string) => request<User>('/auth/profile',{},token),
  updateProfile: (token:string,data:Record<string,unknown>) => request<User>('/auth/profile',{method:'POST',body:JSON.stringify(data)},token),
  sessions: (token:string) => request<ActiveSession[]>('/auth/sessions',{},token),
  revokeSession: (token:string,sessionId:string) => request<{revoked:boolean}>('/auth/sessions/revoke',{method:'POST',body:JSON.stringify({sessionId})},token),
  privacyExport: (token:string) => request<unknown>('/privacy/export',{},token),
  deleteAccount: (token:string) => request<unknown>('/privacy/account',{method:'DELETE'},token),
  register: (data: { email?: string; phone: string; password: string; accountType: AccountType; fullName?: string; city?: string; province?: string; suburb?: string; deliveryAddress?: { label: string; address: string; city: string; province: string; suburb?: string }; notificationPreference?: string; acceptedPolicies?: boolean }) => request<Session>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  createBusiness: (token: string, data: { name: string; slug: string }) => request<ManagedBusiness>('/businesses', { method: 'POST', body: JSON.stringify(data) }, token),
  createSupportTicket: (token: string, data: { businessId?: string; category: string; subject: string; details: string }) => request<unknown>('/support/tickets', { method: 'POST', body: JSON.stringify(data) }, token),
  customerWorkspace: (token:string) => request<CustomerWorkspace>('/customer/workspace',{},token),
  createBooking: (token:string,data:{serviceId:string;branchId?:string;startsAt:string;notes?:string}) => request<unknown>('/bookings',{method:'POST',body:JSON.stringify(data)},token),
  openConversation: (token:string,data:{businessId:string;orderId?:string}) => request<{id:string}>('/conversations',{method:'POST',body:JSON.stringify(data)},token),
  conversations: (token:string) => request<any[]>('/conversations',{},token),
  conversationMessages: (token:string,id:string) => request<any[]>(`/conversations/${id}/messages`,{},token),
  sendMessage: (token:string,id:string,body:string) => request<unknown>(`/conversations/${id}/messages`,{method:'POST',body:JSON.stringify({body})},token),
  escalateConversation: (token:string,id:string) => request<unknown>(`/conversations/${id}/escalate`,{method:'POST'},token),
  deleteMessage: (token:string,conversationId:string,messageId:string) => request<{deleted:boolean}>(`/conversations/${conversationId}/messages/${messageId}`,{method:'DELETE'},token),
  createRequest: (token:string,data:Record<string,unknown>) => request<unknown>('/requests',{method:'POST',body:JSON.stringify(data)},token),
  acceptQuote: (token:string,requestId:string,quoteId:string) => request<unknown>(`/requests/${requestId}/quotes/${quoteId}/accept`,{method:'POST'},token),
  followProduct: (token:string,productId:string) => request<unknown>(`/growth/products/${productId}/follow`,{method:'POST'},token),
  payOrder: (token:string,orderId:string,provider:string) => request<any>('/finance/payments',{method:'POST',body:JSON.stringify({orderId,provider,idempotencyKey:crypto.randomUUID()})},token),
  paymentReceipt: (token:string,paymentId:string) => request<any>(`/finance/payments/${paymentId}/receipt`,{},token),
  completeDemoPayment: (token:string,paymentId:string) => request<any>(`/finance/demo/payments/${paymentId}/complete`,{method:'POST',body:JSON.stringify({status:'SUCCEEDED'})},token),
  requestRefund: (token:string,orderId:string,amount:number,reason:string) => request<unknown>('/finance/refunds',{method:'POST',body:JSON.stringify({orderId,amount,reason})},token),
  reviewOrder: (token:string,orderId:string,rating:number,comment?:string) => request<unknown>(`/orders/${orderId}/review`,{method:'POST',body:JSON.stringify({rating,comment})},token),
  disputeOrder: (token:string,orderId:string,reason:string,details:string) => request<unknown>(`/orders/${orderId}/dispute`,{method:'POST',body:JSON.stringify({reason,details})},token),
  reportActivity: (token:string,data:{businessId?:string;reason:string;details?:string}) => request<unknown>('/reports',{method:'POST',body:JSON.stringify(data)},token),
  createProduct: (token: string, businessId: string, data: { name: string; slug: string; description?: string; price: number; stockQuantity: number; status: string }) => request<Product>(`/businesses/${businessId}/products`, { method: 'POST', body: JSON.stringify(data) }, token),
  createBranch: (token:string,businessId:string,data:{name:string;province:string;city:string;suburb?:string;deliveryAreas?:string[];operatingHours?:Record<string,string>}) => request<Branch>(`/businesses/${businessId}/branches`,{method:'POST',body:JSON.stringify(data)},token),
  createBusinessService: (token:string,businessId:string,data:{name:string;category:string;description?:string;durationMinutes:number;price?:number;currency?:string}) => request<MarketplaceService>(`/businesses/${businessId}/services`,{method:'POST',body:JSON.stringify(data)},token),
  createAd: (token: string, businessId: string, productId: string, title: string) => request<Ad>(`/businesses/${businessId}/ads`, { method: 'POST', body: JSON.stringify({ productId, title }) }, token),
  assistant: (message: string) => request<AssistantReply>('/assistant/message', { method: 'POST', body: JSON.stringify({ message }) }),
  customerOrders: (token: string) => request<Order[]>('/orders/mine', {}, token),
  createOrder: (token: string, items: { productId: string; quantity: number }[], recipient?:{name:string;phone:string;address:string;city:string}) => request<Order>('/orders', { method: 'POST', body: JSON.stringify({ items,recipient }) }, token),
  customerRequests: (token: string) => request<unknown[]>('/requests/mine', {}, token),
  managedBusinesses: (token: string) => request<ManagedBusiness[]>('/businesses', {}, token),
  addBusinessStaff: (token:string,businessId:string,data:{phone:string;role:string;branchIds:string[]}) => request<BusinessMember>(`/businesses/${businessId}/staff`,{method:'POST',body:JSON.stringify(data)},token),
  businessSettings: (token:string,businessId:string) => request<{settings?:Record<string,unknown>}>(`/businesses/${businessId}/settings`,{},token),
  updateBusinessSettings: (token:string,businessId:string,settings:Record<string,unknown>) => request<{settings:Record<string,unknown>}>(`/businesses/${businessId}/settings`,{method:'PATCH',body:JSON.stringify({settings})},token),
  submitFiscalisation: (token:string,businessId:string,data:Record<string,unknown>) => request<Fiscalisation>(`/businesses/${businessId}/fiscalisation`,{method:'POST',body:JSON.stringify(data)},token),
  businessNotifications: (token:string,businessId:string) => request<{messages:any[];orderAlerts:any[];stockAlerts:any[]}>(`/businesses/${businessId}/notifications`,{},token),
  readBusinessNotification: (token:string,businessId:string,notificationId:string) => request<{read:boolean}>(`/businesses/${businessId}/notifications/${notificationId}/read`,{method:'PATCH'},token),
  businessProducts: (token: string, businessId: string) => request<Product[]>(`/businesses/${businessId}/products`, {}, token),
  businessOrders: (token: string, businessId: string) => request<Order[]>(`/orders/business/${businessId}`, {}, token),
  updateBusinessOrderStatus: (token: string, businessId: string, orderId: string, status: string) => request<Order>(`/orders/business/${businessId}/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, token),
  businessReport: (token: string, businessId: string) => request<Record<string, unknown>>(`/reports/businesses/${businessId}`, {}, token),
  adminReports: (token: string) => request<unknown[]>('/admin/reports', {}, token),
  adminTickets: (token: string) => request<unknown[]>('/admin/support/tickets', {}, token),
  fraudSignals: (token: string) => request<unknown[]>('/admin/fraud-signals', {}, token),
};
