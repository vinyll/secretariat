const BetaGouv = require('../betagouv');
const config = require('../config');
const utils = require('./utils');
const knex = require('../db');
const { toPlainObject } = require('lodash');

module.exports.getNewsletter = async function (req, res) {
  try {
    let newsletters = await knex('newsletters').select().orderBy('year_week', 'desc');
    const usersInfos = await BetaGouv.usersInfos();
    newsletters = newsletters.map((newsletter) => ({
      ...newsletter,
      sent_at: newsletter.sent_at
        ? utils.formatDateToReadableDateAndTimeFormat(newsletter.sent_at) : undefined,
      title: utils.formatDateToFrenchTextReadableFormat(utils.getDateOfISOWeek(newsletter.year_week.split('-')[1], newsletter.year_week.split('-')[0])),
      validator: (usersInfos.find((u) => u.id === newsletter.validator) || {}).fullname || 'membre supprimé',
    }));

    res.render('newsletter', {
      errors: req.flash('error'),
      messages: req.flash('message'),
      userConfig: config.user,
      domain: config.domain,
      currentUserId: req.user.id,
      currentNewsletter: newsletters.shift(),
      newsletters,
      activeTab: 'newsletter',
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Impossible de récupérer les newsletters.');
    res.render('newsletter', {
      errors: req.flash('error'),
      messages: req.flash('message'),
      userConfig: config.user,
      domain: config.domain,
      currentUserId: req.user.id,
      currentNewsletter: undefined,
      newsletters: [],
      activeTab: 'newsletter',
    });
  }
};

module.exports.validateNewsletter = async() => {
  if (req.body.text === 'validate') {
    let newsletter = await knex('newsletters').orderBy('year_week').first();
    let newsletter = await knex('newsletters')
      .where({ year_week: newsletter.year_week })
      .update({ validator: req.body.REMPLACER_PAR_USER_SLACK_NAME });
  } else {
    // send error message
  }
}