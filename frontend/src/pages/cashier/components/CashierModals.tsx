import React from 'react';
import { HiOutlineDocumentText, HiOutlineCash } from 'react-icons/hi';

export const EndOfDayModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6" onClick={onClose}>
            <div className="bg-surface-800 p-6 sm:p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl border border-surface-700 relative text-center animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HiOutlineDocumentText className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-surface-100">Gün sonu</h3>
                <p className="text-surface-300 text-lg relative z-[100] selection:bg-brand-500/30">Təsdiq etmək istəyirsinizmi?</p>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => { onClose(); onConfirm(); }}
                        className="flex-1 py-3 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 active:scale-95 shadow-lg shadow-brand-500/25 transition-all outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-800"
                    >
                        Bəli
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-surface-700 text-surface-300 font-semibold hover:bg-surface-600 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-surface-500"
                    >
                        Xeyr
                    </button>
                </div>
            </div>
        </div>
    );
};

export const PaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onPayCash: () => void;
    onPayCard: () => void;
}> = ({ isOpen, onClose, onPayCash, onPayCard }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6" onClick={onClose}>
            <div className="bg-surface-800 p-6 sm:p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl border border-surface-700 relative text-center animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HiOutlineCash className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-surface-100">Ödəniş növü</h3>
                <p className="text-surface-300 text-lg relative z-[100] selection:bg-brand-500/30">Zəhmət olmasa ödəniş növünü seçin</p>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => { onClose(); onPayCash(); }}
                        className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 active:scale-95 shadow-lg shadow-emerald-500/25 transition-all outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-surface-800"
                    >
                        Nağd Ödəniş
                    </button>
                    <button
                        onClick={() => { onClose(); onPayCard(); }}
                        className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 active:scale-95 shadow-lg shadow-blue-500/25 transition-all outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-surface-800"
                    >
                        Kartla Ödəniş
                    </button>
                </div>
            </div>
        </div>
    );
};
