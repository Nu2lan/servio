/**
 * Shared receipt printing utilities for the Servio POS system.
 * Eliminates duplicated receipt CSS, HTML templates, and iframe print logic
 * across WaiterDashboard and CashierDashboard.
 */
import toast from 'react-hot-toast';

// ─── Shared 80mm receipt CSS ───
const RECEIPT_CSS = `
@page { size: 80mm auto; margin: 0 }
* { margin: 0; padding: 0; box-sizing: border-box }
body { font-family: 'Courier New', monospace; width: 72mm; min-height: 80mm; margin: 0 auto; padding: 5mm 4mm; font-size: 16px; line-height: 1.5 }
.pub { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 3mm; letter-spacing: 1px }
h3 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 2mm }
.info { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding-bottom: 2mm; margin-bottom: 3mm; border-bottom: 1px dashed #000 }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 }
td { font-size: 16px; font-weight: bold; padding: 4px 0 }
.t { border-top: 2px dashed #000; font-weight: bold; font-size: 18px; padding-top: 3mm; margin-top: 3mm; text-align: right }
.f { text-align: center; margin-top: 4mm; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; border-top: 1px dashed #000; padding-top: 3mm }
`.trim();

// ─── Multi-page receipt CSS (kitchen/bar tickets) ───
const RECEIPT_MULTIPAGE_CSS = `
@page { size: 80mm auto; margin: 0 }
* { margin: 0; padding: 0; box-sizing: border-box }
body { font-family: 'Courier New', monospace; font-size: 16px; line-height: 1.5; background: #fff; margin: 0; padding: 0; }
.receipt-page { width: 72mm; min-height: 80mm; margin: 0 auto; padding: 5mm 4mm; }
.pub { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 3mm; letter-spacing: 1px }
h3 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 2mm }
.info { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding-bottom: 2mm; margin-bottom: 3mm; border-bottom: 1px dashed #000 }
table { width: 100%; border-collapse: collapse; margin: 3mm 0; }
td { font-size: 16px; font-weight: bold; padding: 4px 0; }
.f { text-align: center; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; border-top: 1px dashed #000; padding-top: 3mm; margin-top: 3mm; }
`.trim();

// ─── Table header for item lists (3-column) ───
function buildItemsTableHtml(
    items: { name: string; qty: number; price?: number; cancelled?: boolean }[],
    showPrice: boolean = true,
): string {
    const headers = showPrice
        ? '<thead><tr><td style="width: 50%; border-bottom:1px dashed #000;padding-bottom:3px">Məhsul adı</td><td style="width: 20%; text-align:center;border-bottom:1px dashed #000;padding-bottom:3px">Say</td><td style="width: 30%; text-align:right;border-bottom:1px dashed #000;padding-bottom:3px">Qiymət</td></tr></thead>'
        : '<thead><tr><td style="width: 70%; border-bottom:1px dashed #000;padding-bottom:3px">Məhsul adı</td><td style="width: 30%; text-align:center;border-bottom:1px dashed #000;padding-bottom:3px">Say</td></tr></thead>';

    const rows = items.map((item) => {
        if (item.cancelled) {
            return `<tr><td style="color:red; text-decoration:line-through; font-style:italic">Ləğv: ${item.name}</td><td style="text-align:center">-${item.qty}</td>${showPrice ? `<td style="text-align:right">-${((item.price || 0) * item.qty).toFixed(2)}</td>` : ''}</tr>`;
        }
        return showPrice
            ? `<tr><td>${item.name}</td><td style="text-align:center">${item.qty}</td><td style="text-align:right">${((item.price || 0) * item.qty).toFixed(2)}</td></tr>`
            : `<tr><td>${item.name}</td><td style="text-align:center">${item.qty}</td></tr>`;
    }).join('');

    return `${headers}<tbody>${rows}</tbody>`;
}

// ─── Build a standard check receipt ───
export interface CheckReceiptOptions {
    title?: string;          // "Artıbir" by default
    subtitle: string;        // Table label (e.g. "Zal 1 - Masa #3") or "Gün sonu"
    staffLabel?: string;     // Waiter/Cashier name
    time?: string;           // Formatted time string
    items: { name: string; qty: number; price: number; cancelled?: boolean }[];
    total?: number;
    cashIncome?: number;
    cardIncome?: number;
    footer?: string;         // "Təşəkkürlər", "LƏĞV ÇEKİ", etc.
    totalLabel?: string;     // "Cəmi" by default
    totalColor?: string;     // e.g. "red" for cancellation receipts
}

export function buildCheckReceiptHtml(opts: CheckReceiptOptions): string {
    const title = opts.title || 'Artıbir';
    const time = opts.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const footer = opts.footer || 'Təşəkkürlər';
    const totalLabel = opts.totalLabel || 'Cəmi';
    const totalColor = opts.totalColor ? `color: ${opts.totalColor}` : '';
    const itemsHtml = buildItemsTableHtml(opts.items, true);

    let totalsHtml = '';
    if (opts.cashIncome !== undefined && opts.cardIncome !== undefined) {
        const totalIncome = opts.cashIncome + opts.cardIncome;
        totalsHtml = [
            `<div class="t" style="text-align: left; font-size: 16px;">`,
            `Nağd Ödəniş: <span style="float: right">${opts.cashIncome.toFixed(2)} AZN</span><br>`,
            `Kartla Ödəniş: <span style="float: right">${opts.cardIncome.toFixed(2)} AZN</span>`,
            `</div>`,
            `<div class="t">${totalLabel}: ${totalIncome.toFixed(2)} AZN</div>`,
        ].join('');
    } else if (opts.total !== undefined) {
        totalsHtml = `<div class="t" style="${totalColor}">${totalLabel}: ${opts.total.toFixed(2)} AZN</div>`;
    }

    return [
        `<!DOCTYPE html><html><head><title>${title}</title>`,
        `<style>${RECEIPT_CSS}</style></head>`,
        '<body>',
        `<div class="pub">${title}</div>`,
        `<h3>${opts.subtitle}</h3>`,
        '<div class="info">',
        opts.staffLabel ? `<span>${opts.staffLabel}</span>` : '<span></span>',
        `<span>${time}</span>`,
        '</div>',
        `<table>${itemsHtml}</table>`,
        totalsHtml,
        `<div class="f">${footer}</div>`,
        '</body></html>',
    ].join('');
}

// ─── Build a kitchen/bar order ticket ───
export interface KitchenTicketOptions {
    title: string;           // "Mətbəx" or "Bar"
    tableLabel: string;
    waiterName?: string;
    time: string;            // Formatted date/time
    items: { name: string; quantity: number }[];
    addPageBreak: boolean;
}

export function buildKitchenTicketHtml(opts: KitchenTicketOptions): string {
    if (opts.items.length === 0) return '';

    const headerHtml = '<thead><tr><td style="width: 70%; border-bottom:1px dashed #000;padding-bottom:3px">Məhsul adı</td><td style="width: 30%; text-align:center;border-bottom:1px dashed #000;padding-bottom:3px">Say</td></tr></thead>';
    const rows = opts.items.map(item =>
        `<tr><td>${item.name}</td><td style="text-align:center">${item.quantity}</td></tr>`
    ).join('');

    return `
        <div class="receipt-page" style="${opts.addPageBreak ? 'page-break-after: always; break-after: page;' : ''}">
            <div style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 3mm; letter-spacing: 1px; text-transform: uppercase;">${opts.title}</div>
            <h3>${opts.tableLabel}</h3>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #000; padding-bottom: 2mm; margin-bottom: 3mm; font-size: 14px; font-weight: bold;">
                <span>${opts.waiterName || ''}</span>
                <span>${opts.time}</span>
            </div>
            <table>${headerHtml}<tbody>${rows}</tbody></table>
            <div class="f">Nuş Olsun!</div>
        </div>
    `;
}

export function wrapKitchenTickets(bodyHtml: string): string {
    return `<!DOCTYPE html><html><head><title>Sifariş Çeki</title><style>${RECEIPT_MULTIPAGE_CSS}</style></head><body>${bodyHtml}</body></html>`;
}

// ─── Print HTML via hidden iframe (Fallback / Browser Print) ───
export function printViaIframe(html: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '80mm';
    iframe.style.height = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 500);
        }, 250);
    } else {
        document.body.removeChild(iframe);
    }
}

// ─── Print HTML silently via QZ Tray ───
import qz from 'qz-tray';
import api from './api';

let securityInitialized = false;

export function initQzSecurity() {
    if (securityInitialized) return;
    securityInitialized = true;

    // Set up QZ Tray Certificates for "Remember this decision"
    qz.security.setCertificatePromise((resolve: (cert: string) => void, reject: (err: Error) => void) => {
        fetch('/qz-cert.pem', { cache: 'no-store' })
            .then(r => r.text())
            .then(resolve)
            .catch(reject);
    });

    qz.security.setSignatureAlgorithm("SHA512");
    qz.security.setSignaturePromise((toSign: string) => {
        return function(resolve: (signature: string) => void, reject: (err: Error) => void) {
            api.get('/qz/sign?request=' + encodeURIComponent(toSign))
                .then(res => resolve(res.data))
                .catch(reject);
        };
    });
}

export async function printHtmlWithQz(html: string, printerName: string | undefined): Promise<void> {
    initQzSecurity();
    if (!printerName) {
        toast.error('Çap qurğusu seçilməyib! Tənzimləmələrdən printer seçin.');
        console.warn('QZ Tray: No printer assigned.');
        return;
    }

    try {
        if (!qz.websocket.isActive()) {
            await qz.websocket.connect({ retries: 2, delay: 1 });
        }

        const config = qz.configs.create(printerName, {
            margins: 0,
            width: 80, // mm
            units: 'mm',
            colorType: 'blackwhite'
        });

        const data = [{
            type: 'pixel',
            format: 'html',
            flavor: 'plain',
            data: html
        }];

        await qz.print(config, data);
        console.log(`QZ Tray: Successfully printed to ${printerName}`);
    } catch (err) {
        console.error('QZ Tray Print Error:', err);
        toast.error('QZ Tray ilə çap edərkən xəta baş verdi. Bağlantını yoxlayın.');
    }
}
