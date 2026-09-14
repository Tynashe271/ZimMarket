import { Product } from './api';
export type CartItem={productId:string;name:string;price:number;quantity:number;businessId:string;businessName:string};
const KEY='zimmarket.cart';
export function readCart():CartItem[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
export function addToCart(product:Product){if(!product.business.id)throw new Error('This product is missing its business identifier.');const items=readCart();const found=items.find(i=>i.productId===product.id);if(found)found.quantity+=1;else items.push({productId:product.id,name:product.name,price:Number(product.price),quantity:1,businessId:product.business.id,businessName:product.business.name});localStorage.setItem(KEY,JSON.stringify(items));return items}
export function saveCart(items:CartItem[]){localStorage.setItem(KEY,JSON.stringify(items))}
