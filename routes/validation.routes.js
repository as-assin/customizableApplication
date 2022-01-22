const express = require('express');

const router = express.Router();

const controller = require('../controllers/validation.controller');

router.post('/identity', controller.validateIdentity);

router.post('/license', controller.validateLicense);

module.exports = router;
