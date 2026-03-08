import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryLog extends Document {
    inventoryItem: mongoose.Types.ObjectId;
    inventoryItemName: string;
    quantityUsed: number;
    stockBefore: number;
    stockAfter: number;
    order: mongoose.Types.ObjectId;
    tableNumber: string;
}

const inventoryLogSchema = new Schema<IInventoryLog>(
    {
        inventoryItem: {
            type: Schema.Types.ObjectId,
            ref: 'Inventory',
            required: true,
        },
        inventoryItemName: {
            type: String,
            required: true,
        },
        quantityUsed: {
            type: Number,
            required: true,
        },
        stockBefore: {
            type: Number,
            required: true,
        },
        stockAfter: {
            type: Number,
            required: true,
        },
        order: {
            type: Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
        },
        tableNumber: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model<IInventoryLog>('InventoryLog', inventoryLogSchema);
