import mongoose from 'mongoose';

/**
 * Run all one-time data migrations after MongoDB connects.
 * Each migration is idempotent — safe to re-run on every startup.
 */
export async function runMigrations(): Promise<void> {
    const db = mongoose.connection.db!;

    const settingsCollection = db.collection('settings');
    const rawSettings = await settingsCollection.findOne({});

    if (rawSettings) {
        // ── 1. Migrate string categories to { name, role } format ──
        if (rawSettings.categories?.length > 0) {
            const first = rawSettings.categories[0];
            if (typeof first === 'string') {
                console.log('📋 Migrating categories to new format...');
                const barKeywords = [
                    'drink', 'cocktail', 'beer', 'alcohol', 'siqaret',
                    'wine', 'whiskey', 'liquor', 'tequilla', 'shot',
                ];
                const migrated = rawSettings.categories.map((c: string) => ({
                    name: c,
                    role: barKeywords.some((k) => c.toLowerCase().includes(k)) ? 'bar' : 'kitchen',
                }));
                await settingsCollection.updateOne(
                    { _id: rawSettings._id },
                    { $set: { categories: migrated } },
                );
                console.log('✅ Categories migrated');
            }
        }

        // ── 4. Migrate halls: add type:'hall' where missing ──
        if (rawSettings.halls?.length > 0) {
            const needsMigration = rawSettings.halls.some((h: any) => !h.type);
            if (needsMigration) {
                console.log('📋 Migrating halls: adding type field...');
                const migratedHalls = rawSettings.halls.map((h: any) => ({
                    ...h,
                    type: h.type || 'hall',
                }));
                await settingsCollection.updateOne(
                    { _id: rawSettings._id },
                    { $set: { halls: migratedHalls } },
                );
                console.log('✅ Halls type field migrated');
            }
        }
    }

    // ── 2. Migrate tableNumber from number → string in orders ──
    const ordersCollection = db.collection('orders');
    const numericOrders = await ordersCollection.countDocuments({ tableNumber: { $type: 'number' } });
    if (numericOrders > 0) {
        console.log(`📋 Migrating ${numericOrders} orders: tableNumber number → string...`);
        const cursor = ordersCollection.find({ tableNumber: { $type: 'number' } });
        for await (const doc of cursor) {
            await ordersCollection.updateOne(
                { _id: doc._id },
                { $set: { tableNumber: String(doc.tableNumber) } },
            );
        }
        console.log('✅ Orders tableNumber migrated');
    }

    // ── 3. Migrate tableNumber from number → string in inventorylogs ──
    const logsCollection = db.collection('inventorylogs');
    const numericLogs = await logsCollection.countDocuments({ tableNumber: { $type: 'number' } });
    if (numericLogs > 0) {
        console.log(`📋 Migrating ${numericLogs} inventory logs: tableNumber number → string...`);
        const logCursor = logsCollection.find({ tableNumber: { $type: 'number' } });
        for await (const doc of logCursor) {
            await logsCollection.updateOne(
                { _id: doc._id },
                { $set: { tableNumber: String(doc.tableNumber) } },
            );
        }
        console.log('✅ InventoryLogs tableNumber migrated');
    }
}
