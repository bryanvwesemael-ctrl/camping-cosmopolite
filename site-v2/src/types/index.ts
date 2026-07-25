// Gedeelde types voor alle content. De content zelf leeft (voorlopig) in de
// i18n-bestanden; deze vorm is bewust generiek zodat ze later 1-op-1 uit de
// Supabase-CMS (website_paginas) kan komen zonder de componenten te wijzigen.
export type Lang = 'nl' | 'fr';

export interface Feature { icon: string; title: string; text: string; }
export interface Activity { icon: string; title: string; text: string; image: string; }
export interface RentalOption { id: string; name: string; price?: string; text: string; features: string[]; image: string; }
export interface PriceItem { icon: string; label: string; price: string; highlight?: boolean; }
export interface Review { name: string; location: string; rating: number; text: string; }
export interface FaqItem { q: string; a: string; }
export interface TimelineItem { year: string; title: string; text: string; }
export interface MetaSet { title: string; description: string; }
