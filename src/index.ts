import bodyParser from 'body-parser';
import compression from 'compression';
import flash from 'connect-flash';
import cookieParser from 'cookie-parser';
import express from 'express';
import { expressjwt, Request } from "express-jwt";
import expressSanitizer from 'express-sanitizer';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import path from 'path';
import config from '@config';
import * as accountController from '@controllers/accountController';
import * as adminController from '@/controllers/adminController';
import * as communityController from '@controllers/communityController';
import * as githubNotificationController from '@controllers/githubNotificationController';
import * as indexController from '@controllers/indexController';
import * as loginController from '@controllers/loginController';
import * as logoutController from '@controllers/logoutController';
import * as marrainageController from '@controllers/marrainageController';
import * as newsletterController from '@controllers/newsletterController';
import * as onboardingController from '@controllers/onboardingController';
import * as resourceController from '@controllers/resourceController';
import * as startupController from '@controllers/startupController';
import * as usersController from '@controllers/usersController';
import * as mapController from '@controllers/mapController';
import * as hookController from '@controllers/hookController';
import * as pullRequestsController from '@controllers/pullRequestsController';
import { getWhatIsGoingOnWithMemberController } from '@/controllers/whatIsGoingOnWithMemberController/whatIsGoingOnWithMemberController';
import * as sentry from './lib/sentry';
import EventBus from '@infra/eventBus/eventBus';
import { MARRAINAGE_EVENTS_VALUES } from '@models/marrainage';
import routes from './routes/routes';
import permit, { MemberRole } from './middlewares/authorization';
import { publicGetRouteRateLimiter, publicPostRouteRateLimiter, rateLimiter } from './middlewares/rateLimiter';
import { getStartupInfoUpdate, postStartupInfoUpdate } from './controllers/startupController';

const app = express();
EventBus.init([...MARRAINAGE_EVENTS_VALUES])

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views/templates')); // the code is running in directory "dist".

app.use(compression());
app.use('/public', express.static(path.join(__dirname, './public')));
app.use('/static', express.static(path.join(__dirname, '../static')));
app.use(
  '/datagouvfr',
  express.static(
    path.join(__dirname, process.env.NODE_ENV === 'production' ? '../..' : '..', 'node_modules/template.data.gouv.fr/dist')
  )
); // hack to mimick the behavior of webpack css-loader (used to import template.data.gouv.fr)
app.use(
  '/react-datepicker/react-datepicker.css',
  express.static(
    path.join(__dirname, process.env.NODE_ENV === 'production' ? '../..' : '..', 'node_modules/react-datepicker/dist/react-datepicker.css')
  )
)
app.use(
  '/react-tabulator/styles.css',
  express.static(
    path.join(__dirname, process.env.NODE_ENV === 'production' ? '../..' : '..', 'node_modules/react-tabulator/lib/styles.css')
  )
);
app.use(
  '/react-tabulator/tabulator.min.css',
  express.static(
    path.join(__dirname, process.env.NODE_ENV === 'production' ? '../..' : '..', 'node_modules/react-tabulator/lib/css/tabulator.min.css')
  )
); 
app.use(
  '/topbar.js',
  express.static(path.join(__dirname, process.env.NODE_ENV === 'production' ? '../..' : '..', 'node_modules/topbar/topbar.min.js'))
);

app.use(cookieParser(config.secret));
app.use(session({ cookie: { maxAge: 300000, sameSite: 'lax' } })); // Only used for Flash not safe for others purposes
app.use(flash());
app.use(expressSanitizer());
// const router = express.Router()
// router.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(rateLimiter);

const getJwtTokenForUser = (id) =>
  jwt.sign({ id }, config.secret, { expiresIn: '7 days' });

app.use(
  expressjwt({
    secret: config.secret,
    algorithms: ['HS256'],
    getToken: (req) => req.cookies.token || null,
  }).unless({
    path: [
      '/',
      '/login',
      routes.LOGIN_API,
      '/signin',
      '/marrainage/accept',
      '/marrainage/decline',
      '/notifications/github',
      routes.WHAT_IS_GOING_ON_WITH_MEMBER,
      routes.PULL_REQUEST_GET_PRS,
      routes.ONBOARDING,
      routes.ONBOARDING_ACTION,
      /api\/public\/users\/*/,
      /hook\/*/,
      /onboardingSuccess\/*/,
      /api\/public\/account\/base-info\/*/
    ],
  })
);

// Save a token in cookie that expire after 7 days if user is logged
app.use((req: Request, res, next) => {
  if (req.auth && req.auth.id) {
    res.cookie('token', getJwtTokenForUser(req.auth.id), { sameSite: 'lax' });
  }
  next();
});

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    // redirect to login and keep the requested url in the '?next=' query param
    if (req.method === 'GET') {
      req.flash(
        'message',
        "Pour accéder à cette page vous devez vous identifier, vous pouvez le faire en renseignant votre email juste en dessous."
      );
      const nextParam = req.url ? `?next=${req.url}` : '';
      return res.redirect(`/login${nextParam}`);
    }
  }
  return next(err);
});

app.get('/', indexController.getIndex);
app.get('/login', loginController.getLogin);
app.post('/login', loginController.postLogin);
app.post(routes.LOGIN_API, express.json({type: '*/*'}), loginController.postLoginApi);
app.get('/signin', loginController.getSignIn);
app.post('/signin', loginController.postSignIn);
app.get('/logout', logoutController.getLogout);
// que ce passe-t-il
app.get(routes.WHAT_IS_GOING_ON_WITH_MEMBER, getWhatIsGoingOnWithMemberController)
// users
app.post(routes.USER_CREATE_EMAIL, usersController.createEmailForUser);
app.post(routes.USER_CREATE_EMAIL_API, express.json({type: '*/*'}), usersController.createEmailApi);

app.post(routes.USER_DELETE_EMAIL, usersController.deleteEmailForUser);
app.post(routes.USER_UPGRADE_EMAIL, usersController.upgradeEmailForUser);
app.post(routes.USER_CREATE_REDIRECTION, usersController.createRedirectionForUser);
app.post(routes.USER_DELETE_REDIRECTION, usersController.deleteRedirectionForUser);
app.post(routes.USER_UPDATE_PASSWORD, usersController.updatePasswordForUser);
app.post(routes.USER_UPDATE_SECONDARY_EMAIL, usersController.manageSecondaryEmailForUser);
app.post(routes.USER_UPDATE_PRIMARY_EMAIL, usersController.managePrimaryEmailForUser);
app.post(routes.USER_UPDATE_END_DATE, usersController.updateEndDateForUser);
app.get(routes.API_GET_PUBLIC_USER_INFO, publicGetRouteRateLimiter, usersController.getUserInfo);
app.get(routes.PULL_REQUEST_GET_PRS, pullRequestsController.getAllPullRequests)
//
app.post(
  '/notifications/github',
  githubNotificationController.processNotification
);
app.post('/marrainage', marrainageController.createRequest);
app.get('/marrainage/accept', marrainageController.acceptRequest);
app.get('/marrainage/decline', marrainageController.declineRequest);
app.post('/marrainage/cancel', marrainageController.cancelRequest);
app.post('/marrainage/reload', marrainageController.reloadRequest);

app.get(routes.ME, express.json({type: '*/*'}), accountController.getCurrentUser);
app.get(routes.ACCOUNT_GET, accountController.getCurrentAccount);
app.get(routes.ACCOUNT_GET_DETAIL_INFO_FORM, accountController.getDetailInfoUpdate);
app.post(routes.ACCOUNT_POST_DETAIL_INFO_FORM, accountController.postCurrentInfo);
app.get(routes.ACCOUNT_GET_BASE_INFO_FORM, usersController.getBaseInfoUpdate);
app.post(routes.ACCOUNT_POST_BASE_INFO_FORM, express.json({type: '*/*'}), usersController.postBaseInfoUpdate);
app.post(routes.API_PUBLIC_POST_BASE_INFO_FORM, publicPostRouteRateLimiter, express.json({ type: '*/*'}), usersController.publicPostBaseInfoUpdate)

app.get('/community', communityController.getCommunity);
app.get('/community/:username', communityController.getUser);

app.get(routes.ADMIN, adminController.getEmailLists);

// STARTUP
app.get(routes.STARTUP_GET_ALL, startupController.getStartupList);
app.get(routes.STARTUP_GET_DETAIL, startupController.getStartup);
app.get(routes.STARTUP_GET_INFO_UPDATE_FORM, getStartupInfoUpdate)
app.post(routes.STARTUP_POST_INFO_UPDATE_FORM, express.json({type: '*/*'}), postStartupInfoUpdate)

// ONLY FOR ADMIN
app.get(routes.ADMIN_MATTERMOST, permit(MemberRole.MEMBER_ROLE_ADMIN), adminController.getMattermostAdmin);
app.get(routes.ADMIN_MATTERMOST_MESSAGE_API, permit(MemberRole.MEMBER_ROLE_ADMIN), adminController.getMattermostUsersInfo);
app.post(routes.ADMIN_MATTERMOST_SEND_MESSAGE, permit(MemberRole.MEMBER_ROLE_ADMIN), adminController.sendMessageToUsersOnChat);

app.get(routes.ONBOARDING, onboardingController.getForm);
app.post(routes.ONBOARDING_ACTION, onboardingController.postForm);
app.get('/onboardingSuccess/:prNumber', onboardingController.getConfirmation);
app.post('/account/set_email_responder', accountController.setEmailResponder);
app.post('/account/delete_email_responder', accountController.deleteEmailResponder);
app.post('/account/set_email_responder', accountController.setEmailResponder);
app.post('/account/update_communication_email', accountController.updateCommunicationEmail);

app.get('/newsletters', newsletterController.getNewsletter);
app.get('/validateNewsletter', newsletterController.validateNewsletter);
app.get('/cancelNewsletter', newsletterController.cancelNewsletter);

app.get('/resources', resourceController.getResources);
app.get('/api/get-users', adminController.getUsers);
app.get('/api/get-users-location', mapController.getUsersLocation);
app.get('/map', mapController.getMap);
app.post('/hook/:hookId', express.json({type: '*/*'}), hookController.postToHook);


sentry.initCaptureConsoleWithHandler(app);

export default app.listen(config.port, () =>
  console.log(`Running on: ${config.protocol}://${config.host}:${config.port}`)
);
