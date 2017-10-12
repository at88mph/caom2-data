'use strict';

var express = require('express');
var router = express.Router();
var secret = 'opencadc1987';

// sign with default (HMAC SHA256)
var jwt = require('jsonwebtoken');

// Ensure the VAULT_TOKEN and VAULT_ADDR environment variables are set.
// process.env.VAULT_ADDR = URL of the Vault server (e.g. http://site.com:8200).
// process.env.VAULT_TOKEN = Hash Token of the master key.
var vaultOptions = {
    apiVersion: 'v1' // default
};

var vault = require('node-vault')(vaultOptions);

console.log('Endpoint for Vault: ' + vault.endpoint);

// init vault server
vault
    .initialized()
    .then(function(result) {
        if (result.initialized === false) {
            vault.init({ secret_shares: 3, secret_threshold: 3 });
        } else {
            console.log('Vault is initialized.');
        }
    })
    .then(function() {
        var key = process.env.VAULT_ACCESS_TOKEN_1;
        console.log(key);
        return vault.unseal({ secret_shares: 3, key: key });
    })
    .then(function() {
        var key = process.env.VAULT_ACCESS_TOKEN_2;
        console.log(key);
        return vault.unseal({ secret_shares: 3, key: key });
    })
    .then(function() {
        var key = process.env.VAULT_ACCESS_TOKEN_3;
        console.log(key);
        return vault.unseal({ secret_shares: 3, key: key });
    });

function authenticate(payload, res) {
    var username = payload.username;
    var password = payload.password;

    if (!username || !password) {
        res
            .status(400)
            .send('\n"username" and "password" are required for Login.\n');
    } else {
        var mountPoint = 'auth';

        console.log('Getting auths to login as ' + username);

        vault
            .auths({ followAllRedirects: true })
            .then(function(result) {
                // Check if LDAP is already enabled.
                if (result.hasOwnProperty('ldap/')) {
                    return undefined;
                } else {
                    return vault.enableAuth({
                        mount_point: mountPoint,
                        type: 'ldap',
                        description: 'ldap auth'
                    });
                }
            })
            .then(function() {
                console.log('Logging in as ' + username);
                vault
                    .ldapLogin({ username: username, password: password })
                    .then(function(loginResult) {
                        var authObject = loginResult.auth;
                        var token = jwt.sign(
                            {
                                username: authObject.metadata.username,
                                client_token: authObject.client_token
                            },
                            secret,
                            { expiresIn: '2 days' }
                        );
                        res.status(200).json(token);
                    })
                    .catch(function(err) {
                        console.log('Login unsuccessful.');
                        res.status(err.statusCode).json(err);
                    });
            })
            .catch(function(err) {
                console.error('Error: ' + err.message);
                res
                    .status(500)
                    .json({ error: 'Unable to login. \n' + err.message + '\n' });
            });
    }
}

/**
 * POST login information.
 */
router.post('/', function(req, res) {
    authenticate(req.body, res);
});

/**
 * Login with GET.  Not recommended, but here anyway.
 */
router.get('/', function(req, res) {
    authenticate(req.query, res);
});

module.exports = router;
