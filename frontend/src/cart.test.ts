import { beforeEach, describe, expect, it } from 'vitest';
import { addToCart, readCart, saveCart } from './cart';
import type { Product } from './api';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return { id: 'product-a', name: 'Maputi Snacks', slug: 'maputi-snacks', price: 2.5, business: { id: 'business-a', name: 'Harare Traders', slug: 'harare-traders' }, ...overrides };
}

beforeEach(() => localStorage.clear());

describe('cart storage', () => {
  it('starts empty when nothing has been saved', () => {
    expect(readCart()).toEqual([]);
  });

  it('recovers gracefully from corrupted cart data instead of throwing', () => {
    localStorage.setItem('zimmarket.cart', '{not-json');
    expect(readCart()).toEqual([]);
  });

  it('adds a new product as a single-quantity line item', () => {
    const items = addToCart(makeProduct());
    expect(items).toEqual([{ productId: 'product-a', name: 'Maputi Snacks', price: 2.5, quantity: 1, businessId: 'business-a', businessName: 'Harare Traders' }]);
    expect(readCart()).toEqual(items);
  });

  it('increments the quantity when the same product is added again', () => {
    addToCart(makeProduct());
    const items = addToCart(makeProduct());
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('refuses to add a product with no business identifier', () => {
    expect(() => addToCart(makeProduct({ business: { name: 'Harare Traders', slug: 'harare-traders' } }))).toThrow(/missing its business identifier/);
  });

  it('persists whatever list is saved, replacing the previous cart', () => {
    saveCart([{ productId: 'a', name: 'A', price: 1, quantity: 1, businessId: 'b', businessName: 'B' }]);
    saveCart([]);
    expect(readCart()).toEqual([]);
  });
});
