const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] } // Obligatoire pour Bot-hosting
});

// --- AUTOMATISATION DES STATUTS ---
client.on('message', async msg => {
    // Si vous recevez un statut (broadcast)
    if (msg.isStatus) {
        await msg.react('❤️'); // Like automatique des statuts
        console.log(`Statut de ${msg.from} liké automatiquement.`);
    }
});

// --- INTERFACE DE GESTION ---
io.on('connection', (socket) => {
    console.log('Interface connectée');

    // Envoyer les conversations à l'interface
    socket.on('get_chats', async () => {
        const chats = await client.getChats();
        socket.emit('list_chats', chats);
    });

    // Envoyer un message depuis l'interface
    socket.on('send_message', async ({ to, message }) => {
        await client.sendMessage(to, message);
    });

    // Changer le profil depuis l'interface
    socket.on('update_profile', async ({ name, bio }) => {
        if(name) await client.setDisplayName(name);
        if(bio) await client.setStatus(bio);
    });
});

client.initialize();
server.listen(process.env.PORT || 3000);
