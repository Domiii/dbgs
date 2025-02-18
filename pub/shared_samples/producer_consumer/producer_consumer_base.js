/* eslint-disable no-console */
import noop from 'lodash/noop';
import seedrandom from 'seedrandom';

const seed = 'dbux';
function random(isProducer, id) {
  const user = isProducer ? 'producer' : 'consumer';
  const rng = seedrandom(`${seed}_${user}_${id}`);
  return rng();
}

// ###########################################################################
//  States & Constants
// ###########################################################################

// config
// export const IdleTime = 1;
export const N = 3;
const ProducerTime = 1;
const ProducerTimeVar = 2;
const ConsumerTime = 3;
const ConsumerTimeVar = 2;
const MaxItems = 2;

// global queue
const items = [];
let nItems = 0;
const producingBuffer = [];
const consumingBuffer = [];
let lastProducingItem = 0;
let lastConsumingItem = 0;
let consuming = 0;
let producing = 0;


/** ###########################################################################
 * util (copied from asyncUtil)
 * ##########################################################################*/

export function randomInt(n, isProducer, item) {
  return Math.floor(random(isProducer, item) * n);
}

// ###########################################################################
//  Buffer control
// ###########################################################################

function getFreeSpaceIndex() {
  for (let i = 0; i < MaxItems; ++i) {
    if (!items[i]) {
      return i;
    }
  }
  return null;
}

function getConsumableIndex() {
  for (let i = 0; i < MaxItems; ++i) {
    if (items[i] && !producingBuffer[i] && !consumingBuffer[i]) {
      return i;
    }
  }
  return null;
}

function getBufferString() {
  const str = items.map((val, index) => {
    if (val) {
      if (producingBuffer[index]) {
        return `${val}(producing)`;
      }
      else if (consumingBuffer[index]) {
        return `${val}(consuming)`;
      }
      else {
        return `${val}`;
      }
    }
    else {
      return 'null';
    }
  });
  return `[${str}]`;
}

// ###########################################################################
//  Public
// ###########################################################################

function useItem(item) {
  // noop
  noop(item);
}

export function hasSpace() {
  return (producing + nItems) < MaxItems;
}

export function hasItems() {
  return nItems - consuming > 0;
}

export function getProduceTime(item) {
  return Math.max(
    1,
    (ProducerTime - ProducerTimeVar) + randomInt(ProducerTimeVar * 2 + 1, true, item)
  );
}

export function startProduce() {
  ++producing;
  const item = ++lastProducingItem;
  const index = getFreeSpaceIndex();
  const produceTime = getProduceTime(item);
  items[index] = item;
  producingBuffer[index] = item;
  if (index === null) {
    throw new Error(`tried to produce when full`);
  }
  console.log(`producing item ${item}, using ${produceTime} ticks...`);
  useItem(item);
  return [index, item, produceTime];
}

export function finishProduce(index) {
  --producing;
  ++nItems;
  const item = producingBuffer[index];
  delete producingBuffer[index];

  console.log(`produced item ${item}, remaining: ${nItems}, producing: ${producing}, buffer: ${getBufferString()}`);
  useItem(item);
}

export function getConsumeTime(item) {
  return Math.max(
    1,
    (ConsumerTime - ConsumerTimeVar) + randomInt(2 * ConsumerTimeVar + 1, false, item)
  );
}

export function startConsume() {
  ++consuming;
  const index = getConsumableIndex();
  const item = items[index];
  const consumeTime = getConsumeTime(item);
  if (index === null) {
    throw new Error(`tried to consume when empty`);
  }
  consumingBuffer[index] = item;
  console.log(`consuming item ${item}, using ${consumeTime} ticks...`);
  useItem(item);
  return [index, item, consumeTime];
}

export function finishConsume(index) {
  const item = items[index];
  delete items[index];
  delete consumingBuffer[index];
  --nItems;
  --consuming;
  console.log(`consumed item ${item}, remaining: ${nItems}, consuming: ${consuming}, buffer: ${getBufferString()}`);
  useItem(item);
}


/** ###########################################################################
 * other utilities
 * ##########################################################################*/

// function noop() { }

function normalizeCondition(condition) {
  if (!(condition instanceof Function)) {
    let n = condition;
    // console.trace('normalizeCondition', condition);
    condition = () => {
      const oldN = n;
      n = Math.max(n - 1, 0);
      // console.log('norm cond', oldN);
      return !!oldN;
    };
  }
  return condition;
}

export function workTicksPromise(condition) {
  condition = normalizeCondition(condition);
  return workUntil(condition);
}

function workUntil(condition) {
  let p = Promise.resolve();
  if (condition()) {
    // keep repeating
    return p.then(function workOne() {
      return workUntil(condition);
    });
  }
  return p;
}

export function pt(cb) {
  return Promise.resolve().then(cb);
}


export function schedule(cb) {
  // NOTE: we wrap `cb` to make sure that the same static context is used for all schedule calls.
  function callbackDriver() {
    cb();
  }
  setImmediate(callbackDriver);
  // setImmediate(cb);
}

export function waitTicksCallback(t, task) {
  repeatCallback(t, task);
}

export function repeatCallback(condition, task = noop) {
  condition = normalizeCondition(condition);
  if (condition()) {
    schedule(function nestedRepeat() { repeatCallback(condition, task); });
  }
  else {
    task();
  }
}
