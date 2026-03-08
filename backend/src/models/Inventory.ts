import mongoose, { Schema, Document } from 'mongoose';

export interface IInventory extends Document {
    name: string;
    stock: number;
    unit: string;
    lastUpdated: Date;
}

const inventorySchema = new Schema<IInventory>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        stock: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        unit: {
            type: String,
            default: 'portions',
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

export default mongoose.model<IInventory>('Inventory', inventorySchema);
