// jobs/timeout.job.js
// Cron job unificado para timeouts de eventos y proyectos.
// Ejecuta cada 10 minutos y llama a los contratos correspondientes.
const cron = require('node-cron');
const { Keypair } = require('@stellar/stellar-sdk');
const { Event } = require('../models/Event');
const { Project } = require('../models/Project');
const contracts = require('../contracts');
function startTimeoutJob() {
    const schedule = process.env.TIMEOUT_CRON_SCHEDULE || '*/10 * * * *';
    cron.schedule(schedule, async () => {
        console.log('[timeout-job] Ejecutando verificación de timeouts...');
        const platformKeypair = Keypair.fromSecret(
            process.env.PLATFORM_SECRET || process.env.ADMIN_SECRET
        );
        const now = Math.floor(Date.now() / 1000);
        // ── EventContract timeouts ──
        try {
            const expiredEvents = await Event.find({
                status: 'active',
                deadline_selection: { $lt: now },
                on_chain_id: { $exists: true, $ne: null },
            });
            for (const event of expiredEvents) {
                try {
                    await contracts.timeoutDistribute(platformKeypair, event.on_chain_id);
                    event.status = 'expired';
                    await event.save();
                    console.log(`[timeout-job] Event ${event.on_chain_id} expirado y fondos redistribuidos.`);
                } catch (err) {
                    console.error(`[timeout-job] Error timeout_distribute event ${event.on_chain_id}:`, err.message);
                }
            }
        } catch (err) {
            console.error('[timeout-job] Error buscando eventos expirados:', err.message);
        }
        // ── ProjectContract timeouts ──
        // timeout_approve: proyectos entregados con deadline vencido
        try {
            const expiredDelivered = await Project.find({
                status: 'review',
                deadline: { $lt: now },
                on_chain_id: { $exists: true, $ne: null },
            });
            for (const project of expiredDelivered) {
                try {
                    await contracts.timeoutApprove(platformKeypair, project.on_chain_id);
                    project.status = 'completed';
                    await project.save();
                    console.log(`[timeout-job] Project ${project.on_chain_id} auto-aprobado por timeout.`);
                } catch (err) {
                    console.error(`[timeout-job] Error timeout_approve project ${project.on_chain_id}:`, err.message);
                }
            }
        } catch (err) {
            console.error('[timeout-job] Error buscando proyectos para auto-approve:', err.message);
        }
        // timeout_refund: proyectos creados o en corrección con deadline vencido
        try {
            const expiredCreatedOrCorrecting = await Project.find({
                status: { $in: ['proposed', 'correcting'] },
                deadline: { $lt: now },
                on_chain_id: { $exists: true, $ne: null },
            });
            for (const project of expiredCreatedOrCorrecting) {
                try {
                    await contracts.timeoutRefund(platformKeypair, project.on_chain_id);
                    project.status = 'rejected';
                    await project.save();
                    console.log(`[timeout-job] Project ${project.on_chain_id} reembolsado por timeout.`);
                } catch (err) {
                    console.error(`[timeout-job] Error timeout_refund project ${project.on_chain_id}:`, err.message);
                }
            }
        } catch (err) {
            console.error('[timeout-job] Error buscando proyectos para refund:', err.message);
        }
        console.log('[timeout-job] Verificación de timeouts completada.');
    });
    console.log(`[timeout-job] Cron job de timeouts configurado: ${schedule}`);
}
module.exports = { startTimeoutJob };
