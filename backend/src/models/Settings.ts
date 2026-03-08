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
                { name: 'Fast Food', role: 'kitchen' },
                { name: 'Hot drinks', role: 'bar' },
                { name: 'Cold drinks', role: 'bar' },
                { name: 'Non-Alcohol cocktails', role: 'bar' },
                { name: 'Cocktails', role: 'bar' },
                { name: 'Draft beer', role: 'bar' },
                { name: 'Bottle beer', role: 'bar' },
                { name: 'Fruit', role: 'kitchen' },
                { name: 'Hot lunch', role: 'kitchen' },
                { name: 'Çərəzlər', role: 'kitchen' },
                { name: 'Souslar', role: 'kitchen' },
                { name: 'Alcohol drinks', role: 'bar' },
                { name: 'Siqaretlər', role: 'bar' },
            ],
        },
        halls: {
            type: [hallSchema],
            default: [
                { name: 'Zal 1', tables: Array.from({ length: 8 }, (_, i) => i + 1), type: 'hall' as const },
            ],
        },
    },
    { timestamps: true }
);

export default mongoose.model<ISettings>('Settings', settingsSchema);
