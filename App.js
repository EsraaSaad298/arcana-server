const express = require('express'); 
const bodyParser = require('body-parser');
const axios = require("axios");
const { initializeApp } = require("firebase/app");
const crypto = require('crypto');
const IP = require('ip');
const { Timestamp,  getFirestore, doc, getDoc, updateDoc, arrayUnion } = require('firebase/firestore/lite');

const firebaseConfig = {
    apiKey: "AIzaSyDWh0ySAbT5mJKNi7RR0KemlTsU-KNcaL0",
    authDomain: "backend-db-ce68e.firebaseapp.com",
    projectId: "backend-db-ce68e",
    storageBucket: "backend-db-ce68e.appspot.com",
    messagingSenderId: "893354591028",
    appId: "1:893354591028:web:87f003fd04f0765c685b61",
    measurementId: "G-B04LN1S0H1"
};

const firebase = initializeApp(firebaseConfig);
const db = getFirestore(firebase);

const app = express(); 
app.use(express.json());
app.use(bodyParser.text());

app.get("/", (req, res) => {
    res.json("Hello World!"); 
});

function encrypt(text) {
    const key = crypto.randomBytes(32); // 256 bits
    const iv = crypto.randomBytes(16); // 128 bits
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    console.log({
        encrypted: encrypted,
        key: key.toString('hex'),
        iv: iv.toString('hex')
    }
    )
    return {
        encrypted: encrypted,
        key: key.toString('hex'),
        iv: iv.toString('hex')
    };
};


const restrictedAddressCheck = async (address) => {
    try {
	const response = await axios.get(`https://api.country.is/${address}`);
        if(response.data.country == "PH" || response.data.country == "BR")
            return true;
        else
            return false;
    } catch (error) {
        console.error('Error making API request:', error.message);
    }
};

const updateRecordTime = async (doc_id, remote_address) => {
    await axios.get(`https://api.country.is/${remote_address}`)
    .then(async (response) => {
        const arcaneRecordDoc = doc(db, 'Records', doc_id);
        const currentTime = Timestamp.now().toDate().toLocaleString('en-US', {
            timeZone: 'Asia/Dubai',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true, // Use 24-hour format
        });
        await updateDoc(arcaneRecordDoc, {
            records: arrayUnion({ time: currentTime, location: response.data.country }),
        });
    })
    .catch((err) => {
        return;
    });
};

//get game app
app.post("/getArcane", async (req, res) => {
    try {
	    const socketAddress = req.socket.remoteAddress;
        const remoteAddress = socketAddress.substring(socketAddress?.lastIndexOf(':') + 1);
        const { document } = req.body;
        //update Records
        await updateRecordTime(document, remoteAddress);
        const arcaneDoc = doc(db, 'Arcana', document);
        const arcaneSnapshot = await getDoc(arcaneDoc);
        const remoteAddrBlock = await restrictedAddressCheck(remoteAddress);
        if (arcaneSnapshot.exists()) {
            const arcaneData = arcaneSnapshot.data();
            if ((arcaneData.restricted && !remoteAddrBlock) || arcaneData.code == 1 ) {
                arcaneData.nexa = "";
            }
            return res.status(200).json(arcaneData);
        } else {
            return res.status(404).json({ message: "Document not found" });
        }
    } catch (error) {
        return res.status(500).json({ message: error.message  });
    }
});

app.post("/updateArcaneCode", async (req, res) => {
    try {
        const { document, code } = req.body;
        const arcaneDoc = doc(db, 'Arcana', document);
        await updateDoc(arcaneDoc, { code });
        return res.status(200).json({ message: "Document updated successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message  });
    }
});

app.post("/updateArcaneNexa", async (req, res) => {
    try {
        const { document, nexa } = req.body;
        const arcaneDoc = doc(db, 'Arcana', document);
        const { encrypted, key, iv } = encrypt(nexa);
        await updateDoc(arcaneDoc, { nexa: encrypted, key: key, iv: iv });
        return res.status(200).json({ message: "Document updated successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

app.post("/updateArcaneStatus", async (req, res) => {
    try {
        const { document, restricted } = req.body;
        const arcaneDoc = doc(db, 'Arcana', document);
        await updateDoc(arcaneDoc, { restricted });
        return res.status(200).json({ message: "Document updated successfully" });
    } catch (error) {
        return res.status(500).json({ message: error.message  });
    }
});

app.post("/updateArcane", async (req, res) => {
    try {
        const { document, code, nexa, restricted } = req.body;
        const arcaneDoc = doc(db, 'Arcana', document);
        const updateFields = {};

        if (code !== undefined) {
            updateFields.code = code;
        }

        if (nexa !== undefined) {
            const { encrypted, key, iv } = encrypt(nexa);
            updateFields.nexa = encrypted;
            updateFields.key = key;
            updateFields.iv = iv;
        }

        if (restricted !== undefined) {
            updateFields.restricted = restricted;
        }

        await updateDoc(arcaneDoc, updateFields);
        return res.status(200).json({ message: "Document updated successfully" });
        
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

const port = 3000; 

app.listen(port, () => { 
  console.log(`API server is running on port ${port}`); 
});