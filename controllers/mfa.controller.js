const axios = require('axios');
const {
    getTenantInfo,
    getErrorMessage,
} = require('../services/commonUtilService');

module.exports.smsOtp = async (req, res, next) => {
    const tenantInfo = getTenantInfo();
    const url = tenantInfo.AUTH_SERVER_BASE_URL;
    const { verificationId } = req.body;

    const options = {
        method: 'POST',
        url: `${url}/v2.0/factors/smsotp/${verificationId}/verifications`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization,
        },
        data: {},
    };
    try {
        const otpResponse = await axios(options);
        res.status(200).send({
            message: 'OTP sent to your phone',
            ...otpResponse.data,
        });
    } catch (error) {
        getErrorMessage(error, next);
    }
};

module.exports.registrationMfa = async (req, res, next) => {
    const tenantInfo = getTenantInfo();
    const url = tenantInfo.AUTH_SERVER_BASE_URL;
    let data = { enabled: true, userId: req.body.userId };
    if (req.body.mfaMethod === 'email') {
        data = { ...data, emailAddress: req.body.emailAddress };
    } else {
        data = { ...data, phoneNumber: req.body.phoneNumber };
    }
    const methodType = req?.body?.type;
    const options = {
        method: 'POST',
        url: `${url}/v2.0/factors/${methodType}otp`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization,
        },
        data,
    };
    try {
        let response = false;
        response = await axios(options);
        const id = response?.data?.id || req.body.verifyId;
        const verificationUrl = `${url}/v2.0/factors/${methodType}otp/${id}/verifications`;
        const verificationOptions = {
            method: 'POST',
            url: verificationUrl,
            headers: {
                'Content-Type': 'application/json',
                Authorization: req.headers.authorization,
            },
            data: {},
        };

        response = await axios(verificationOptions);
        res.status(201).send({
            data: {
                ...response?.data,
                verificationId: id,
            },
            message: 'Otp has been sent to your mobile number!',
        });
    } catch (error) {
        getErrorMessage(error, next);
    }
};

module.exports.verifyOtp = async (req, res, next) => {
    const tenantInfo = getTenantInfo();
    const options = {
        method: 'POST',
        url: `${tenantInfo.AUTH_SERVER_BASE_URL}/v2.0/factors/emailotp/transient/verifications/${req.body.id}`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization,
        },
        data: { otp: req.body.otp },
    };
    try {
        await axios(options);
        res.status(200).send({
            message: 'OTP verified succssfully !',
            status: 200,
        });
    } catch (error) {
        getErrorMessage(error, next);
    }
};

module.exports.registrationOtp = async (req, res, next) => {
    const tenantInfo = getTenantInfo();
    const url = `${tenantInfo.AUTH_SERVER_BASE_URL}/v2.0/factors/${req.body?.type}/${req.body?.verificationId}/verifications/${req.body?.id}?returnJwt=true`;
    const options = {
        method: 'POST',
        url,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `${req.headers.authorization}`,
        },
        data: { otp: req.body.otp },
    };
    try {
        await axios(options);
        res.status(200).send({
            message: 'Your mobile number validated successfully!',
            status: 200,
        });
    } catch (error) {
        getErrorMessage(error, next);
    }
};

module.exports.mailOTP = async (req, res, next) => {
    const tenantInfo = getTenantInfo();
    const email = req.body.emailAddress;
    const url = tenantInfo.AUTH_SERVER_BASE_URL;
    const otpOptions = {
        method: 'POST',
        url: `${url}/v2.0/factors/emailotp/transient/verifications`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: req.headers.authorization,
        },
        data: {
            emailAddress: email,
        },
    };
    try {
        const otpResponse = await axios(otpOptions);
        res.status(200).send({ ...otpResponse.data });
    } catch (error) {
        getErrorMessage(error, next);
    }
};
