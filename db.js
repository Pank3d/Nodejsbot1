const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('postgres', 'pank3d', 'Max20051125_', {
  host: 'localhost',
  dialect: 'postgres',
});

module.exports = sequelize;