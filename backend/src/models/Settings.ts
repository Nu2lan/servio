import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory {
    name: string;
    role: 'kitchen' | 'bar';
}

export interface IHall {
    name: string;
    tables: number[];
    type: 'hall' | 'cabinet';
}

export interface ISettings extends Document {
    tableCount: number;
    categories: ICategory[];
    halls: IHall[];
    workingHoursStart: string;
    workingHoursEnd: string;
    timezone: string;
    printerReceipt: string;
    printerKitchen: string;
    printerBar: string;
    printerCancel: string;
}

const categorySchema = new Schema<ICategory>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ['kitchen', 'bar'],
            default: 'kitchen',
        },
    },
    { _id: false }
);

const hallSchema = new Schema<IHall>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        tables: {
            type: [Number],
            default: [],
        },
        type: {
            type: String,
            enum: ['hall', 'cabinet'],
            default: 'hall',
        },
    },
    { _id: false }
);

const settingsSchema = new Schema<ISettings>(
    {
        tableCount: {
            type: Number,
            required: true,
            default: 20,
            min: 1,
        },
        categories: {
            type: [categorySchema],
            default: [
                { name: 'Alcohol Sets', role: 'bar' },
                { name: 'Bottle Beer', role: 'bar' },
                { name: 'Cocktails', role: 'bar' },
                { name: 'Draft Beer', role: 'bar' },
                { name: 'Fast Food', role: 'kitchen' },
                { name: 'Liqueurs & Spirits', role: 'bar' },
                { name: 'Non-Alcohol Cocktails', role: 'bar' },
                { name: 'Rums', role: 'bar' },
                { name: 'Shots', role: 'bar' },
                { name: 'Snacks', role: 'kitchen' },
                { name: 'Soft Drinks', role: 'bar' },
                { name: 'Tequilas', role: 'bar' },
                { name: 'Whiskeys', role: 'bar' },
                { name: 'Wines', role: 'bar' },
            ],
        },
        halls: {
            type: [hallSchema],
            default: [
                { name: 'Zal 1', tables: Array.from({ length: 8 }, (_, i) => i + 1), type: 'hall' as const },
            ],
        },
        workingHoursStart: {
            type: String,
            default: '10:00',
        },
        workingHoursEnd: {
            type: String,
            default: '02:00',
        },
        timezone: {
            type: String,
            default: 'Asia/Baku',
        },
        printerReceipt: {
            type: String,
            default: '',
        },
        printerKitchen: {
            type: String,
            default: '',
        },
        printerBar: {
            type: String,
            default: '',
        },
        printerCancel: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

export default mongoose.model<ISettings>('Settings', settingsSchema);
