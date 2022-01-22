const axios = require('axios');
const fs = require('fs');
const qs = require('qs');
const ErrorClass = require('./error.service');
const { tenantConfig } = require('../constants/constants');

function validateRequest(request, params) {
    let isInvalidRequest = Object.keys(params).some(
        (key) => !Object.keys(request).includes(key)
    );
    if (isInvalidRequest) return isInvalidRequest;

    const invalidArray = [null, undefined, 'null', 'undefined', ''];
    for (const key in params) {
        if (params[key] && invalidArray.includes(request[key])) {
            isInvalidRequest = true;
            break;
        }
    }
    return isInvalidRequest;
}

function getErrorMessage(error, next) {
    let err = error;
    if (error?.response?.data?.messageId) {
        err = new ErrorClass(
            `${error.response.data.messageId} ${error.response.data.messageDescription}`,
            error.response.status
        );
    } else if (error?.response?.body) {
        err = new ErrorClass(error.response.body, error.response.status);
    } else if (error?.response?.status) {
        err = new ErrorClass(error.response.statusText, error.response.status);
    }
    next(err);
}

function getTenantInfo() {
    const tenantInfo = fs.readFileSync(tenantConfig, 'utf-8');
    return JSON.parse(tenantInfo).find((arr) => arr.DEFAULT);
}

async function authorize(clientID, clientSecret, OIDC_BASE_URI) {
    try {
        const options = {
            method: 'POST',
            url: `${OIDC_BASE_URI}/token`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: qs.stringify({
                grant_type: 'client_credentials',
                client_id: clientID,
                client_secret: clientSecret,
                scope: 'openid',
            }),
        };
        const response = await axios(options);
        return response.data;
    } catch (err) {
        return err;
    }
}

const cssToJson = (cssStr) => {
    if (!cssStr) return {};
    let tmp = '';
    let openBraces = 0;
    for (let i = 0; i < cssStr.length; i++) {
        const c = cssStr[i];
        if (c === '{') {
            openBraces++;
        } else if (c === '}') {
            openBraces--;
        }
        if (openBraces === 0 && c === ':') {
            tmp += '_--_';
        } else {
            tmp += c;
        }
    }
    cssStr = tmp;
    cssStr = cssStr.split('"').join("'");
    cssStr = cssStr.split(' ').join('_SPACE_');
    cssStr = cssStr.split('\r').join('');
    cssStr = cssStr.split('\n').join('');
    cssStr = cssStr.split('\t').join('');
    cssStr = cssStr.split('!important').join('');
    cssStr = cssStr.split('}').join('"}####"');
    cssStr = cssStr.split(';"').join('"');
    cssStr = cssStr.split(':').join('":"');
    cssStr = cssStr.split('{').join('":{"');
    cssStr = cssStr.split(';').join('","');
    cssStr = cssStr.split('####').join(',');
    cssStr = cssStr.split('_--_').join(':');
    cssStr = cssStr.split('_SPACE_').join(' ');
    if (cssStr.endsWith(',')) {
        cssStr = cssStr.substr(0, cssStr.length - 1);
    }
    if (cssStr.endsWith(',"')) {
        cssStr = cssStr.substr(0, cssStr.length - 2);
    }
    cssStr = `{"${cssStr}}`;
    try {
        const jsn = JSON.parse(cssStr);
        return jsn;
    } catch (e) {
        return null;
    }
};

const allowedCSSProps = ['color', 'backgroundColor'];

const JSToCSS = (jsObject) => {
    const result = Object.entries(jsObject)
        .filter(([key, value]) => !!value.selector)
        .map(([key, value]) => {
            return `${value.selector}{\n${Object.entries(value)
                .filter(([k, v]) => allowedCSSProps.includes(k))
                .map(
                    ([k, v]) =>
                        `  ${k
                            .replace(/[A-Z]/g, '-$&')
                            .toLowerCase()
                            .trim()}:${v};`
                )
                .join('\n')}\n}`;
        })
        .join('\n');
    return result;
};

module.exports = {
    validateRequest,
    getTenantInfo,
    authorize,
    cssToJson,
    JSToCSS,
    getErrorMessage,
};
