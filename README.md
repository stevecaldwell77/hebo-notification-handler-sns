# hebo-notification-handler-sns

[![build status](https://img.shields.io/travis/stevecaldwell77/hebo-notification-handler-sns.svg)](https://travis-ci.org/stevecaldwell77/hebo-notification-handler-sns)
[![code coverage](https://img.shields.io/codecov/c/github/stevecaldwell77/hebo-notification-handler-sns.svg)](https://codecov.io/gh/stevecaldwell77/hebo-notification-handler-sns)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/stevecaldwell77/hebo-notification-handler-sns.svg)](LICENSE)

> Notification Handler implementation for hebo-js that uses AWS SNS


## Table of Contents

* [Install](#install)
* [Usage](#usage)
* [Contributors](#contributors)
* [License](#license)


## Install

[npm][]:

```sh
npm install hebo-notification-handler-sns
```

[yarn][]:

```sh
yarn add hebo-notification-handler-sns
```


## Usage

```js
const HeboNotificationHandlerSns = require('hebo-notification-handler-sns');

const heboNotificationHandlerSns = new HeboNotificationHandlerSns();

console.log(heboNotificationHandlerSns.renderName());
// script
```


## Contributors

| Name               |
| ------------------ |
| **Steve Caldwell** |


## License

[MIT](LICENSE) © Steve Caldwell


## 

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/
