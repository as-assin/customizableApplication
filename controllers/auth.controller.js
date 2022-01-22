const axios = require('axios');
const fs = require('fs');

const { validateRequest, authorize, getTenantInfo } = require('../services/commonUtilService');
const { userJsonPath } = require('../constants/constants');

const ErrorClass = require('../services/error.service');

module.exports.signUp = async (req, res, next) => {
    try {
        const isInvalidRequest = validateRequest(req.body, {
            SSN: true,
            firstName: true,
            lastName: true,
            email: true,
        });
        if (isInvalidRequest) {
            throw new ErrorClass(
                'Bad Request. Either missing or Invalid request data',
                400
            );
        }

        if (req.body.SSN.length !== 9) {
            throw new ErrorClass('Please provide a valid SSN', 400);
        }

        const tenantInfo = getTenantInfo();
        const data = req.body;
        const authBody = await authorize(
            tenantInfo.API_CLIENT_ID,
            tenantInfo.API_CLIENT_SECRET,
            tenantInfo.OIDC_BASE_URI
        );

        if (!authBody || !authBody.access_token) {
            throw new ErrorClass('Incorrect tenant data', 400);
        }
        const accessToken = authBody.access_token;

        const userInfo = {
            schemas: [
                'urn:ietf:params:scim:schemas:core:2.0:User',
                'urn:ietf:params:scim:schemas:extension:ibm:2.0:User',
            ],
            userName: data.email,
            name: {
                givenName: data.firstName,
                familyName: data.lastName,
            },
            preferredLanguage: 'en-US',
            active: true,
            emails: [
                {
                    value: data.email,
                    type: 'work',
                },
            ],
            addresses: [
                {
                    formatted: data.address,
                    type: 'work',
                },
            ],
            'urn:ietf:params:scim:schemas:extension:ibm:2.0:User': {
                userCategory: 'regular',
                twoFactorAuthentication: false,
                customAttributes: [
                    {
                        name: 'ssn',
                        values: [data.SSN],
                    },
                ],
            },
        };
        const themId = tenantInfo.THEME_ID;
        const options = {
            method: 'post',
            url: `${tenantInfo.AUTH_SERVER_BASE_URL}/v2.0/Users?themeId=${themId}`,
            headers: {
                'Content-Type': 'application/scim+json',
                Authorization: `Bearer ${accessToken}`,
            },
            data: userInfo,
        };
        await axios(options);
        await updateEnable(data.SSN, data.firstName, data.lastName);
        res.status(201).send({
            response: 'User account created successfully',
            status: 201,
        });
    } catch (err) {
        let error;
        if (
            err.response &&
            err.response.status &&
            err.response.status === 409
        ) {
            error = new ErrorClass(
                'User with given email already exists, Please login',
                403
            );
        } else if (
            err.response &&
            err.response.data &&
            err.response.data.detail
        ) {
            error = new ErrorClass(
                err.response.data.detail,
                err.response.status
            );
        } else if (err.response) {
            error = new ErrorClass(
                err.response.statusText,
                err.response.status
            );
        } else {
            error = err;
        }
        next(error);
    }
};

async function updateEnable(ssn, firstName, lastName) {
    const userJson = JSON.parse(fs.readFileSync(userJsonPath, 'utf-8'));
    for (let i = 0; i < userJson.length; i++) {
        const user = userJson[i];
        if (
            user.ssn === ssn &&
            user.firstName === firstName &&
            user.lastName === lastName
        ) {
            user.enabled = true;
            break;
        }
    }
    fs.writeFileSync(userJsonPath, JSON.stringify(userJson, null, 4), 'utf8');
}
