require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const axios = require('axios');
const qs = require('qs');
const session = require('express-session');
const passport = require('passport');
const OpenIDStrategy = require('passport-openidconnect').Strategy;

const authRouter = require('./routes/auth.routes');
const themesRouter = require('./routes/themes.routes');
const tenantConfigFile = require('./routes/tenantConfigFile.routes');
const userRouter = require('./routes/user.routes');
const dpcmRouter = require('./routes/dpcm.routes');
const validateRouter = require('./routes/validation.routes');
const ErrorClass = require('./services/error.service');
const { getTenantInfo, authorize } = require('./services/commonUtilService');
const mfaRouter = require('./routes/mfa.routes');
const setupRouter = require('./routes/setup.routes');
const { tenantConfig } = require('./constants/constants');

app.use(express.json());

app.use(bodyParser.json());

app.use(
    bodyParser.urlencoded({
        extended: false,
    })
);

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CLIENT_ENDPOINT);
    res.header('Access-Control-Allow-Credentials', true);
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin,X-Requested-With,Content-Type,Accept,Authorization'
    );
    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,DELETE,PATCH,OPTIONS'
    );
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/auth', authRouter);
app.use('/themes', themesRouter);
app.use('/user', userRouter);
app.use('/mfa', mfaRouter);
app.use('/dpcm', dpcmRouter);
app.use('/setup', setupRouter);
app.use('/validate', validateRouter);
app.use('/', tenantConfigFile);

let tenantInfo = getTenantInfo();
app.set('tenantInfo', tenantInfo);

try {
    setPassportStratergy(tenantInfo);
} catch (error) {
    console.log('Invalid data in the tenant-config.json ', error);
}

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
    })
);

app.use(passport.initialize());
app.use(passport.session());

app.get(
    '/oauth/callback',
    passport.authenticate('openidconnect', {
        failureRedirect: '/',
        successRedirect: `${process.env.CLIENT_ENDPOINT}/redirect`,
    })
);

app.get('/app/dashboard', async (req, res, next) => {
    try {
        tenantInfo = getTenantInfo();
        if (!req.session.apiAccessToken) {
            const authBody = await authorize(
                tenantInfo.API_CLIENT_ID,
                tenantInfo.API_CLIENT_SECRET,
                tenantInfo.OIDC_BASE_URI
            );

            if (!authBody.access_token) {
                return res.status(400).send(authBody);
            }
            req.session.apiAccessToken = authBody.access_token;
        }

        res.status(200).send({
            status: '200',
            data: {
                message: 'LoggedIn successfully',
                profile: req.session.profile,
                accessToken: req.session.accessToken,
                issuer: req.session.issuer,
                apiAccessToken: req.session.apiAccessToken,
            },
        });
    } catch (err) {
        next(err);
    }
});

app.get('/', (req, res) => {
    res.status(401).send('Login Unsuccessful');
});

app.get(
    '/login',
    passport.authenticate('openidconnect', {
        successReturnToOrRedirect: '/',
        scope: 'profile openid',
    })
);

app.get('/logout', async (req, res, next) => {
    const data = {
        client_id: tenantInfo.OIDC_CLIENT_ID,
        client_secret: tenantInfo.OIDC_CLIENT_SECRET,
        token: `Bearer ${req.session.accessToken}`,
        token_type_hint: 'access_token',
    };
    const options = {
        method: 'post',
        url: `${tenantInfo.OIDC_BASE_URI}/revoke`,
        data: qs.stringify(data),
        config: {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        },
    };
    try {
        await axios(options);
        req.session.loggedIn = false;
        req.session.accessToken = null;
        req.session.profile = null;
        res.redirect(
            `${tenantInfo.AUTH_SERVER_BASE_URL}/idaas/mtfim/sps/idaas/logout?themeId=${tenantInfo.THEME_ID}`
        );
    } catch (error) {
        next(error);
    }
});

app.listen(3001, () => {
    console.log('Server is *_* at port', 3001);
});

app.use((err, req, res, next) => {
    const errorCode = err.code || 500;
    res.status(errorCode).send({
        message: err.message || 'Internal Server Error. Something went wrong!',
        status: errorCode,
    });
});

function setPassportStratergy(config) {
        passport.use(
            new OpenIDStrategy(
                {
                    issuer: config.OIDC_BASE_URI,
                    clientID: config.OIDC_CLIENT_ID,
                    clientSecret: config.OIDC_CLIENT_SECRET,
                    authorizationURL: `${config.OIDC_BASE_URI}/authorize`,
                    userInfoURL: `${config.OIDC_BASE_URI}/userinfo`,
                    tokenURL: `${config.OIDC_BASE_URI}/token`,
                    callbackURL: config.OIDC_REDIRECT_URI,
                    passReqToCallback: true,
                },
                async (
                    req,
                    issuer,
                    profile,
                    policy,
                    idToken,
                    accessToken,
                    refreshToken,
                    params,
                    cb
                ) => {
                    req.session.accessToken = accessToken;
                    req.session.issuer = issuer;
                    req.session.profile = profile;
                    req.session.loggedIn = true;
                    return cb(null, profile);
                }
            )
        );
}

app.put('/configure-tenant', async (req, res, next) => {
    try {
        const file = JSON.parse(fs.readFileSync(tenantConfig, 'utf-8'));

        const newTenantConfiguration = file.map((obj) => {
            return { ...obj, DEFAULT: false };
        });

        const newTenantInfo = req.body;

        const configIndex = newTenantConfiguration.findIndex(
            (arr) => arr.TITLE === req.body.TITLE
        );

        if (configIndex < 0) {
            newTenantConfiguration.push(newTenantInfo);
        } else {
            newTenantConfiguration.splice(configIndex, 1, newTenantInfo);
        }

        const tenantData = JSON.stringify(newTenantConfiguration, null, 4);
        fs.writeFileSync(tenantConfig, tenantData);
        if (!!newTenantInfo.API_CLIENT_ID && !!newTenantInfo.API_CLIENT_SECRET && !!newTenantInfo.OIDC_BASE_URI) {
            const authBody = await authorize(
                newTenantInfo.API_CLIENT_ID,
                newTenantInfo.API_CLIENT_SECRET,
                newTenantInfo.OIDC_BASE_URI
            );
            let configError = '';
            if (!!newTenantInfo.OIDC_CLIENT_ID && !!newTenantInfo.OIDC_CLIENT_SECRET) {
                try {
                    setPassportStratergy(newTenantInfo);
                } catch (error) {
                    configError = `error setting passport config ${error}`;
                }
            }
            if (authBody?.access_token) {
                if (configError) {
                    res.status(400).send({
                        message: `Configuartion details saved and API access token received however ${configError}`,
                        data: authBody
                    });
                } else {
                    res.status(200).send({
                        message: 'The OIDC configuartion details saved and tested successfully!',
                        data: authBody
                    });
                }
            } else {
                res.status(400).send({
                    message: `Configuartion details saved however, ${authBody?.response?.data?.error_description || 'One of the following values are invalid - API_CLIENT_ID, API_CLIENT_SECRET, OIDC_BASE_URI'}`,
                    data: authBody?.response?.data
                });
            }
        } else {
            res.status(200).send({
                message: 'Configuration updated but test failed!',
                data: req.body,
                status: 200,
            });
        }
    } catch (err) {
        next(err);
    }
});
