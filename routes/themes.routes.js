const express = require('express');

const router = express.Router();

const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/assets/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage });

const controller = require('../controllers/themes.controller');

router.post('/saveConfig', controller.saveConfig);

router.post('/resetConfig', controller.resetConfig);

router.get('/configure-client', controller.getClientConfigFile);

router.post('/uploadImage', upload.single('file'), (req, res) => {
    return res.send(req.file);
});

router.get('/user-json', controller.getUserJsonFile);

module.exports = router;
