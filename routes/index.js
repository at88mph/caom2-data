var express = require('express');
var router = express.Router();
var bootstrapVersion = '3.3.7';

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express', bootstrap_version: bootstrapVersion });
});

module.exports = router;
