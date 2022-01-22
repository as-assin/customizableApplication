const fs = require('fs');
const ErrorClass = require('../services/error.service');
const { userJsonPath } = require('../constants/constants');

module.exports.validateIdentity = (req, res, next) => {
    const userJson = JSON.parse(fs.readFileSync(userJsonPath, 'utf-8'));

    if (userJson.length) {
        const userFound = userJson.find(
            (user) =>
                user.ssn === req.body.ssn &&
                user.firstName.toLowerCase() ===
                    req.body.firstName.toLowerCase() &&
                user.lastName.toLowerCase() === req.body.lastName.toLowerCase()
        );
        if (userFound) {
            return res
                .status(200)
                .send({ address: userFound.address, status: 200 });
        }
    }
    const err = new ErrorClass(
        'Entered user data does not match with our record',
        409
    );
    return next(err);
};

module.exports.validateLicense = (req, res, next) => {
    const userJson = JSON.parse(fs.readFileSync(userJsonPath, 'utf-8'));

    if (userJson.length) {
        const userFound = userJson.find(
            (user) =>
                user.ssn === req.body.ssn &&
                user.licenseNumber === req.body.licenseNumber
        );
        if (userFound) {
            return res.status(200).send({
                response: 'License Matched',
                status: 200,
            });
        }
    }
    const err = new ErrorClass(
        'Entered data does not match with our record',
        409
    );
    return next(err);
};
