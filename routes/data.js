'use strict';

var express = require('express');
var URL = require('url');
var router = express.Router();
var expiryInSeconds = 24 * 60 * 60;  // 1 day expiry
var vaultOptions = {
    apiVersion: 'v1', // default
    endpoint: process.env.VAULT_ENDPOINT
};

// Load Vault to obtain the Object Store's access and secret keys.
var vault = require('node-vault')(vaultOptions);

// Minio vs bare AWS SDK
// var AWS = require('aws-sdk');
var Minio = require('minio');

/* GET users listing. */
router.get('/api/v1/:uri', function (req, res, next) {
    var uri = req.params.uri;
    var dataURI = URL.parse(uri);
    var bucketName = dataURI.hostname;
    var objectName = dataURI.pathname.substr(1);

    console.log('\nChecking if ' + req.user.username + ' can download data from bucket ' + bucketName + '/' +
                objectName + '\n');

    // Call CAOM-2 Repo (caom2repo) to check authorization for user.

    // If CAOM-2 authorizes access to this user, then obtain the Object Store key(s) from Vault.
    // init vault server
    // valut.init({secret_shares: 1, secret_threshold: 1}).then...
    vault.initialized().then(function (result) {
        if (result.initialized === false) {
            vault.init({secret_shares: 3, secret_threshold: 3});
        }
        else {
            console.log('Vault is initialized.');
        }
    })    

    var s3Client = new Minio.Client({
                                        endPoint: process.env.S3_ENDPOINT,
                                        port: Number(process.env.S3_ENDPOINT_PORT),
                                        secure: false,
                                        accessKey: process.env.S3_ACCESS_KEY,   // From Vault.
                                        secretKey: process.env.S3_SECRET_KEY   // From Vault.
                                    });

    s3Client.presignedGetObject(bucketName, objectName, expiryInSeconds).then(function (presignedURL, err) {
        console.log(err ? 'Error found: ' + err : 'Redirecting to ' + presignedURL + '\n');

        if (!err) {
            res.redirect(presignedURL);
        }
    });
});

module.exports = router;
