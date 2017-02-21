/**
 * Created by ben on 2/16/17.
 */
'use strict';
console.time('runtime');
const
  fs      = require('fs'),
  util    = require('util'),
  xml2js  = require('xml2js');

const
  Manufacturer  = require('./modules/Manufacturer'),
  Product       = require('./modules/Product');

const
  COMMAND_CLASS               = 'CommandClass',
  CONFIG                      = 'config',
  CONFIG_DIR                  = `${__dirname}/config`,
  META                        = '$',
  MANUFACTURER_SPECIFIC_DATA  = 'ManufacturerSpecificData',
  MANUFACTURER                = 'Manufacturer',
  PRODUCT                     = 'Product';

let path = `manufacturer_specific.xml`;

parseFile(path)
  .then(parseManufacturerSpecific)
  .catch((reason) => {
    console.error(`Error parsing ${path}: ${reason}`);
  });


function parseManufacturerSpecific(results) {
  results = results[MANUFACTURER_SPECIFIC_DATA];
  results = results[MANUFACTURER];//An Array
  results.forEach(parseManufacturer);
  console.timeEnd('runtime');//TODO make above a promise
}

function parseManufacturer(manufacturer) {
  let meta = manufacturer[META];
  let products = manufacturer[PRODUCT];

  manufacturer = new Manufacturer(meta);
  manufacturer.log();

  if (!products)
    return;

  products = products.map(parseProduct);

  Promise.all(products)
    .then((products) => {
      products.forEach((product) => {
        writeFile(manufacturer, product);
      });

    })
    .catch((reason) => {
      console.error(`1: ${reason}`);
    });
}

function parseProduct(product) {
  let meta = product[META];
  product = new Product(meta);
  product.log();

  if (!product[CONFIG])
    return Promise.resolve(product);

  return parseFile(product[CONFIG])
    .then((result) => {
      result = result[PRODUCT];
      result = result[COMMAND_CLASS];
      product.processCommandClasses(result);
      console.log(`${product.name} has ${product.command_classes.length} CCs`);
      return product;
    });
}

function parseFile(path) {
  path = `${CONFIG_DIR}/${path}`;
  let parser = new xml2js.Parser();

  return new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) return reject(err);

      parser.parseString(data, (err, result) => {
        return err ? reject(err) : resolve(result);
      });
    });
  });
}

function categoryProductId(manufacturerId, productTypeId, productId) {
  const id = Buffer.allocUnsafe(6);
  id.writeUInt16BE(manufacturerId);
  id.writeUInt16BE(productTypeId, 2);
  id.writeUInt16BE(productId, 4);
  return id.toString('hex');
}

function writeFile(manufacturer, product) {
  let path = categoryProductId(manufacturer.id, product.type, product.id);
  path = `${__dirname}/descriptors/${path}.json`;
  let file = getTemplate(manufacturer, product);
  fs.writeFileSync(path, file);
}

function getTemplate(manufacturer, product) {
  let template = {
    commands: {},
    command_classes: product.command_classes,
    configurations: [],
    meta: {
      display: {
        manufacturer: manufacturer.name,
        product: product.name
      }
    },
    manufacturerId: manufacturer.id,
    productId: product.id,
    productTypeId: product.type
  };

  return JSON.stringify(template, null, 4);
}