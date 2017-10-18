'use strict'

var express = require('express')
var URL = require('url')
var path = require('path')
var fs = require('fs')
var mirror = require('mirror')
var router = express.Router()
var expiryInSeconds = 24 * 60 * 60 // 1 day expiry
var vaultOptions = {
  apiVersion: 'v1' // default
}

// Load Vault to obtain the Object Store's access and secret keys.
var vault = require('node-vault')(vaultOptions)

// Load the Dat client.
var dat = require('dat')

// For MongoDB value purposes.
var uuid = require('uuid/v4')

var randomString = require('randomstring')

// Minio vs bare AWS SDK
// var AWS = require('aws-sdk');
var Minio = require('minio')

var MongoClient = require('mongodb').MongoClient

/* GET dat file. */
router.get('/api/v1/dat/:hashval', function(req, res, next) {
  var datHash = req.params.hashval
  // Call CAOM-2 Repo (caom2repo) to check authorization for user.

  // If CAOM-2 authorizes access to this user, then obtain the Object Store key(s) from Vault.
  // init vault server
  // valut.init({secret_shares: 1, secret_threshold: 1}).then...
  vault.initialized().then(function(result) {
    if (result.initialized === false) {
      vault.init({ secret_shares: 3, secret_threshold: 3 })
    } else {
      console.log('Vault is initialized.')
    }
  })

  var dest = path.join(__dirname, 'tmp')
  fs.mkdirSync(dest)

  dat(dest, { key: datHash, sparse: true }, function(err, _dat) {
    if (err) {
      throw err
    }

    var network = _dat.joinNetwork()
    network.once('connection', function() {
      console.log('Connected')
    })

    _dat.archive.metadata.update(download)

    function download() {
      var progress = mirror({ fs: _dat.archive, name: '/' }, dest, function(
        err
      ) {
        if (err) {
          throw err
        }

        console.log('Done')
      })
      progress.on('put', function(src) {
        console.log('Downloading', src.name)
      })
    }
  })
})

/* GET S3 file. */
router.get('/api/v1/s3/:uri', function(req, res, next) {
  var uri = req.params.uri
  var dataURI = URL.parse(uri)
  var bucketName = dataURI.hostname
  var objectName = dataURI.pathname.substr(1)

  console.log(
    '\nChecking if ' +
      req.user.username +
      ' can download data from bucket ' +
      bucketName +
      '/' +
      objectName +
      '\n'
  )

  // Call CAOM-2 Repo (caom2repo) to check authorization for user.

  // Get possible locations of this URI.
  MongoClient.connect(process.env.MONGO_ENDPOINT, {
    authSource: 'caom2'
  }).then(function(db, err) {
    if (err) {
      throw err
    } else {
      console.log(
        '\nConnected successfully to ' + process.env.MONGO_ENDPOINT + '\n'
      )

      var collection = db.collection('caom2')

      // Just here to test.  Normally the replication system would write these...
      collection
        .insertOne({
          uri: dataURI,
          url: URL.parse(
            'https://www.' +
              randomString.generate(8) +
              '.ca/archive/v' +
              uuid() +
              '/' +
              bucketName +
              '/' +
              objectName
          )
        })
        .then(function() {
          console.log('Successfully created entry for ' + uri)
        })

      collection
        .find({ uri: dataURI })
        .toArray()
        .then(function(results) {
          for (var i = 0, rl = results.length; i < rl; i++) {
            console.log('Found (' + i + '): ' + results[i].url.href)
          }
        })

      db.close(true)
    }
  })

  // If CAOM-2 authorizes access to this user, then obtain the Object Store key(s) from Vault.
  // init vault server
  // valut.init({secret_shares: 1, secret_threshold: 1}).then...
  vault.initialized().then(function(result) {
    if (result.initialized === false) {
      vault.init({ secret_shares: 3, secret_threshold: 3 })
    } else {
      console.log('Vault is initialized.')
    }
  })

  var s3Client = new Minio.Client({
    endPoint: process.env.S3_ENDPOINT,
    port: Number(process.env.S3_ENDPOINT_PORT),
    secure: false,
    accessKey: process.env.S3_ACCESS_KEY, // From Vault.
    secretKey: process.env.S3_SECRET_KEY // From Vault.
  })

  s3Client
    .presignedGetObject(bucketName, objectName, expiryInSeconds)
    .then(function(presignedURL, err) {
      console.log(
        err ? 'Error found: ' + err : 'Redirecting to ' + presignedURL + '\n'
      )

      if (!err) {
        res.redirect(presignedURL)
      }
    })
})

module.exports = router
