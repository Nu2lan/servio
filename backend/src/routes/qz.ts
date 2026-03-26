import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const router = express.Router();

let privateKey = process.env.QZ_PRIVATE_KEY || '';

if (!privateKey) {
    const paths = [
        path.join(process.cwd(), 'qz-key.pem'),
        path.join(__dirname, '../../qz-key.pem'),
        path.join(__dirname, '../../../qz-key.pem')
    ];
    for (const p of paths) {
        try {
            if (fs.existsSync(p)) {
                privateKey = fs.readFileSync(p, 'utf8');
                break;
            }
        } catch (err) {
            // keep trying
        }
    }
}

if (!privateKey) {
    console.warn('QZ Tray private key not found via Env or File. "Remember this decision" signing will fail.');
}

// QZ Tray requires a simple text response with the base64 signature
router.get('/sign', (req, res) => {
    try {
        const toSign = req.query.request as string;
        if (!toSign) {
            return res.status(400).send('Request parameter missing');
        }
        
        if (!privateKey) {
            return res.status(500).send('Private key not configured on server');
        }

        const sign = crypto.createSign('RSA-SHA512');
        sign.update(toSign);
        const signature = sign.sign(privateKey, 'base64');
        
        res.setHeader('Content-Type', 'text/plain');
        res.send(signature);
    } catch (err) {
        console.error('QZ Sign Error:', err);
        res.status(500).send('Error signing request');
    }
});

export default router;
