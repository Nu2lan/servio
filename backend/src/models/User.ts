import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'waiter' | 'kitchen' | 'cashier' | 'bar';

export interface IUser extends Document {
    username: string;
    password: string;
    role: UserRole;
    pin?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role: {
            type: String,
            enum: ['admin', 'waiter', 'kitchen', 'cashier', 'bar'],
            required: true,
        },
        pin: {
            type: String,
            sparse: true,
            unique: true,
            validate: {
                validator: (v: string) => !v || /^\d{4}$/.test(v),
                message: 'PIN must be exactly 4 digits.',
            },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set('toJSON', {
    transform: (_doc: any, ret: any) => {
        delete ret.password;
        return ret;
    },
});

export default mongoose.model<IUser>('User', userSchema);
