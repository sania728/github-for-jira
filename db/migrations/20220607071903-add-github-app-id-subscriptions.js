"use strict";

const tableName = "Subscriptions";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "githubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn(tableName, "githubAppId");
	}
};
