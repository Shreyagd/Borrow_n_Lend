export type BookCondition = 'Mint' | 'Like New' | 'Very Good' | 'Good' | 'Acceptable';

export type BookType = 'rental' | 'purchase';

export interface BookItem {
  id: string;
  title: string;
  author: string;
  category: string;
  type: BookType;
  rentalWeeks?: number;
  rentalFee?: number;
  purchasePrice?: number;
  deposit?: number;
  condition: BookCondition;
  ownerName: string;
  ownerRating: number;
  ownerLoans: number;
  ownerNote?: string;
  location: string;
  distance: string;
  dateRange?: string;
  coverBg?: string;
  coverAccent?: string;
  tagLabel?: string;
  notes?: string;
  isAccessory?: boolean;
}

export interface CartItem extends BookItem {
  cartId: string;
  addedAt: number;
}

export type FulfillmentMethod = 'pickup' | 'courier';
export type PaymentMethod = 'credits' | 'card' | 'applepay';

export interface ActiveBorrow {
  id: string;
  bookTitle: string;
  author: string;
  lenderName: string;
  dueDate: string;
  daysRemaining: number;
  depositAmount: number;
  lockerName: string;
  compartmentNumber: number;
  accessCode: string;
  qrCodeUrl?: string;
  status: 'active' | 'ready_for_return' | 'returned';
}
