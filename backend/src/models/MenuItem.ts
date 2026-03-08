import mongoose, { Schema, Document } from 'mongoose';

export interface IIngredient {
    inventoryItem: mongoose.Types.ObjectId;
    qty: number;
}

export interface IMenuItem extends Document {
    name: string;
    price: number;
    category: string;
    isActive: boolean;
    ingredients: IIngredient[];
}

const ingredientSchema = new Schema<IIngredient>(
    {
        inventoryItem: {
            type: Schema.Types.ObjectId,
            ref: 'Inventory',
            required: true,
        },
        qty: {
            type: Number,
            required: true,
            min: 0.01,
        },
    },
    { _id: false }
);

const menuItemSchema = new Schema<IMenuItem>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        category: {
            type: String,
            default: 'Uncategorized',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        ingredients: {
            type: [ingredientSchema],
            default: [],
        },
    },
    { timestamps: true }
);

export default mongoose.model<IMenuItem>('MenuItem', menuItemSchema);
