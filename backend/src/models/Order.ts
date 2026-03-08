import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
    menuItem: mongoose.Types.ObjectId;
    name: string;
    quantity: number;
    price: number;
    category: string;
    prepared: boolean;
}

export type OrderStatus = 'confirmed' | 'paid';

export interface IOrder extends Document {
    tableNumber: string;
    items: IOrderItem[];
    totalPrice: number;
    status: OrderStatus;
    createdBy: mongoose.Types.ObjectId;
    paidAt?: Date;
    checkPrinted: boolean;
}

const orderItemSchema = new Schema<IOrderItem>(
    {
        menuItem: {
            type: Schema.Types.ObjectId,
            ref: 'MenuItem',
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        category: {
            type: String,
            default: '',
        },
        prepared: {
            type: Boolean,
            default: false,
        },
    },
    { _id: true }
);

const orderSchema = new Schema<IOrder>(
    {
        tableNumber: {
            type: String,
            required: true,
        },
        items: {
            type: [orderItemSchema],
            required: true,
            validate: [(v: IOrderItem[]) => v.length > 0, 'Order must have at least one item'],
        },
        totalPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: ['confirmed', 'paid'],
            default: 'confirmed',
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        paidAt: {
            type: Date,
        },
        checkPrinted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export default mongoose.model<IOrder>('Order', orderSchema);
