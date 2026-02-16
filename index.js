const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors()); // Autorise ton React à appeler le Back
app.use(express.json()); // Permet de lire les données JSON envoyées par le Front

// Première route de test
app.get('/', (req, res) => {
    res.send('Serveur Eco-Relais opérationnel !');
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`Le serveur tourne : http://localhost:${PORT}`);
});