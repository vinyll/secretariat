import React from 'react'

import DatepickerSelect from '../components/DatepickerSelect'
import { PageLayout } from '../components/PageLayout';
import MemberSelect from "../components/MemberSelect"
import { Member, MemberWithPermission } from '@/models/member';
import { EMAIL_STATUS_READABLE_FORMAT } from '@/models/misc';
import { hydrateOnClient } from '../../hydrateOnClient';
import axios from 'axios';
import routes from '@/routes/routes';
import { EmailStatusCode } from '@/models/dbUser';

enum STEP {
    whichMember = 'whichMember',
    updateEndDate = 'updateEndDate',
    createEmail = 'createEmail',
    showUserInfo = 'showUserInfo',
    waitingForDateToBeUpdated = "waitingForDateToBeUpdated",
    accountPendingCreation = "accountPendingCreation",
    everythingIsGood = "everythingIsGood",
    emailSuspended = "emailSuspended",
    showMember = "showMember",
    accountCreated = "accountCreated",
    emailBlocked = "emailBlocked"
}

type MemberAllInfo = MemberWithPermission & { secondaryEmail?: string, emailInfos,
    isExpired?: boolean,
    isEmailBlocked: boolean,
    hasEmailInfos: boolean,
    hasSecondaryEmail: boolean,
    primaryEmailStatus: string }

interface FormErrorResponse {
    errors?: Record<string,string[]>
    message: string
}

interface Props {
    title?: string,
    users: Member[],
    errors?: string[],
    messages?: string[],
    request: Request,
}

const ConnectedScreen = (props) => {
    const INITIAL_TIME = 30
    const [connected, setConnected] = React.useState(false)
    const [seconds, setSeconds] = React.useState(INITIAL_TIME)
    const [loginSent, setLoginSent] = React.useState(false)
    const [email, setEmail] = React.useState('')
    const [calledOnce, setCalledOnce] = React.useState(false)
    const [wasAlreadyConnected, setWasAlreadyConnected] = React.useState(false)
    const pingConnection = async() => {
        console.log('Ping connection')
        const user = await axios.get(routes.ME).then(res => res.data.user)
        .catch(e => {
            console.log(`L'utilisateur n'est pas connecté`)
        })
        if (user) {
            if (!calledOnce) {
                setWasAlreadyConnected(true)
            }
            setConnected(true)
        }
        if (!calledOnce) {
            setCalledOnce(true)
        }
    }
    React.useEffect(() => {
        // exit early when we reach 0
        if (!seconds) return;
    
        // save intervalId to clear the interval when the
        // component re-renders
        const intervalId = setInterval(() => {
            const prev = seconds
            if (seconds === INITIAL_TIME) {
                pingConnection().catch(console.error);
            }
            if (prev - 1 === 0) {
                setSeconds(INITIAL_TIME)
            } else {
                setSeconds(seconds - 1)
            }
        }, 1000);
    
        // clear interval on re-render to avoid memory leaks
        return () => clearInterval(intervalId);
        // add seconds as a dependency to re-rerun the effect
        // when we update it
      }, [seconds]);

    const onSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.post(routes.LOGIN_API, {
                emailInput: email
            }).then(res => res.data)
            setLoginSent(true)
            await pingConnection()
        } catch(e) {
            console.log(e)
        }
    }

    return <>
        <h2>{props.title}</h2>
        {calledOnce && !wasAlreadyConnected && <div className="notification">
            <p><b>Pour effectuer cette action il faut être connecter, nous allons t'envoyer un lien de connexion</b></p>
            { !connected && !loginSent && <form action={`/login${props.next}`} method="POST" id="login_form" onSubmit={onSubmit}>
                <label htmlFor="emailInput"><b>Ton email (@beta.gouv.fr ou secondaire)</b></label>
                <div className="input__group">
                    <input
                        onChange={e => {
                            setEmail(e.currentTarget.value)
                        }}
                        name="emailInput"
                        type="email"
                        placeholder="prenom.nom@beta.gouv.fr"
                        autoComplete="username"/>
                </div>
                <button className="button" id="primary_email_button">Recevoir le lien de connexion</button>
                <span><a href="#forgot">J'ai oublié mon email</a></span>
            </form>}
            { loginSent && !connected && <p>
                Lien de connexion envoyé ! Clique sur le lien de connexion que tu as reçu par email, puis sur "Me connecter" et reviens sur cette page.<br/>
                Nouveau test de connexion dans {seconds}s.
            </p>}
            {connected && <p>Tu es connecté !</p>}
        </div>}
        {calledOnce && <div style={!connected ? { opacity: 0.5, pointerEvents: 'none'} : {}}>
            {props.children}
        </div>}
    </>
}

const EmailInfo = function({ emailInfos, primaryEmailStatus}) {
    return <><p><span className="font-weight-bold">Email principal</span> : {emailInfos.email}
        {emailInfos.isPro &&
            <span>(offre OVH Pro)</span>}
        {emailInfos.isExchange &&
            <span>(offre OVH Exchange)</span>
        }</p>
        <p><span className="font-weight-bold">Statut de l'email</span> : {primaryEmailStatus}</p>
        <p><span className="font-weight-bold">Compte bloqué pour cause de spam</span> : {emailInfos.isBlocked ? 'oui' : 'non'}</p>
    </>
}

const UserInfo = function(props) {
    return <>
        <p><span className="font-weight-bold">Nom</span>: {props.userInfos.fullname}</p>
        <p><span className="font-weight-bold">Rôle:</span> {props.userInfos.role}</p>
        {props.userInfos.startups && <p>
            <span className="font-weight-bold">Startups actuelles:</span><br/>
                {props.userInfos.startups.map(function(startup){
                    return <>- {startup}<br/></>
                })}
            </p>
        }
        {props.userInfos.end &&
            <p>
                <span className="font-weight-bold">Fin de mission :</span>
                {props.userInfos.end && new Date(props.userInfos.end).toLocaleDateString('fr-FR')}
            </p>    
        }
        {props.userInfos.employer && <p>
            <strong>Employeur : </strong>{ props.userInfos.employer.replace('admin/', '')}
        </p>}
        {props.userInfos.github &&
            <p>
                <strong>Compte Github :</strong>
                {props.userInfos.github &&
                    <a href={`https://github.com/${props.userInfos.github}`}>{props.userInfos.github}</a>}
                { !props.userInfos.github && <p>
                    Non renseigné
                </p>}
            </p>
        }
    </>
}

const MemberComponent = function({
    emailInfos,
    isEmailBlocked,
    hasEmailInfos,
    hasSecondaryEmail,
    isExpired,
    userInfos,
    primaryEmailStatus,
    startFix
}) {
    const steps = [STEP.whichMember, STEP.showMember]
    const showSteps = (!!isExpired || !hasEmailInfos || primaryEmailStatus === EMAIL_STATUS_READABLE_FORMAT[EmailStatusCode.EMAIL_SUSPENDED] || !!isEmailBlocked)
    if (!!isExpired) {
        steps.push(STEP.updateEndDate)
        steps.push(STEP.waitingForDateToBeUpdated)
    }
    if (!hasEmailInfos) {
        steps.push(STEP.createEmail)
        steps.push(STEP.accountPendingCreation)
        steps.push(STEP.accountCreated)
    }
    if (primaryEmailStatus === EMAIL_STATUS_READABLE_FORMAT[EmailStatusCode.EMAIL_SUSPENDED] && !isEmailBlocked) {
        steps.push(STEP.emailSuspended)
    }
    if (primaryEmailStatus !== EMAIL_STATUS_READABLE_FORMAT[EmailStatusCode.EMAIL_SUSPENDED] && isEmailBlocked) {
        steps.push(STEP.emailBlocked)
    }
    steps.push(STEP.everythingIsGood)
    return <div>
    <h2>{userInfos.fullname}</h2>
    {!!userInfos && <UserInfo userInfos={userInfos}/>}
    {!!emailInfos && <EmailInfo emailInfos={emailInfos} primaryEmailStatus={primaryEmailStatus} />}
    {showSteps && <>
        <h3>Quels sont les problèmes ?</h3>
        <ul>
            {!!isExpired && 
                <li>Le contrat de {userInfos.fullname} est arrivé à terme le <strong>{userInfos.end}</strong>.</li>
            }
            {
                primaryEmailStatus === EMAIL_STATUS_READABLE_FORMAT[EmailStatusCode.EMAIL_SUSPENDED] && <li>
                    Son email @beta.gouv.fr est suspendu car sa date de fin a été mise à jour en retard
                </li>
            }
            {
                !hasEmailInfos && <li>
                    Son email a été supprimé.
                </li>
            }
        </ul>
    </>}
    {showSteps && <>
        <div className="notification">
            <p>Pour réactiver son compte il faut :</p>
            <ol>
                {!!isExpired && <li>changer sa date de fin et merger la PR</li>}
                {!hasEmailInfos && <li>Re-créer son email beta</li>}
                {primaryEmailStatus === EMAIL_STATUS_READABLE_FORMAT[EmailStatusCode.EMAIL_SUSPENDED] && <li>changer son mot de passe pour réactiver son email</li>}
                {!!isEmailBlocked && <li>L'email est bloqué pour cause de spam, il faut le réactiver en changeant le mot de passe</li>}
            </ol>
            {!hasEmailInfos && !!hasSecondaryEmail && <p>
                Si tu es un collègue de {userInfos.fullname} tu pourras recréer l'email pour lui/elle :).
            </p>}
            {!hasEmailInfos && !!hasSecondaryEmail && <p>Si tu es {userInfos.fullname} tu pourras recréer l'email toi même une fois ta date de fin à jour.</p>}
            {!hasEmailInfos && !hasSecondaryEmail && <p>
                {userInfos.fullname} n'a pas d'email secondaire, si tu es toi même {userInfos.fullname} il va falloir qu'un collègue le fasse à ta place.
            </p>}
        </div>
    </>}{
        !showSteps && <div className="notification">
            <p>Il n'y a pas de soucis avec cet utilisateur</p>
        </div>
    }
    {showSteps && <>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'}}>
            <button className="button" onClick={() => startFix(steps)} role="button">Commencer la procédure</button>
        </div>
    </>}
</div>
}

export const UpdateEndDateScreen = function(props) {
    const [date, setDate] = React.useState(props.date)
    const [isSaving, setIsSaving] = React.useState(false)
    const [formErrors, setFormErrors] = React.useState({});
    const [errorMessage, setErrorMessage] = React.useState('');
    function changeFormData(value) {
        setDate(value)
    }

    function updateDate() {
        if (isSaving) {
            return
        }
        setIsSaving(true)
        axios.post(routes.API_PUBLIC_POST_BASE_INFO_FORM.replace(':username', props.user.userInfos.id), {
            end: date,
            role: props.user.userInfos.role || '',
            startups: props.user.userInfos.startups || []
        }).then((resp) => {
            setIsSaving(false)
            props.setPullRequestURL(resp.data.pr_url)
            props.next()
        }).catch((resp) => {
            const ErrorResponse : FormErrorResponse = resp.data
            setErrorMessage(ErrorResponse.message)
            setIsSaving(false)
            if (ErrorResponse.errors) {
                setFormErrors(ErrorResponse.errors)
            }
        })
    }

    return <>
        <h2>Mise à jour de la date de fin pour {props.user.userInfos.fullname}</h2>
        <div className="no-margin">
            { !!errorMessage && 
                <p className="text-small text-color-red">{errorMessage}</p>
            }
            <div className="form__group">
                <label htmlFor="end">
                    <strong>Fin de la mission (obligatoire)</strong><br />
                    Si tu n'as pas la date exacte, mets une date dans 6 mois, c'est possible de la corriger plus tard.<br />
                    <i>Au format JJ/MM/YYYY</i>
                </label>
                <DatepickerSelect
                    name="endDate"
                    min={'2020-01-31'}
                    title="En format YYYY-MM-DD, par exemple : 2020-01-31" required
                    dateFormat='dd/MM/yyyy'
                    selected={date}
                    onChange={(date:Date) => changeFormData(date)} />
                { !!formErrors['nouvelle date de fin'] && 
                    <p className="text-small text-color-red">{formErrors['nouvelle date de fin']}</p>
                }
            </div>
            <div className="form__group">
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'}}>
                    <button
                        onClick={updateDate}
                        disabled={isSaving}
                        className="button no-margin"
                        type="submit">Valider le changement de date</button>
                </div>
            </div>
        </div>
    </>
}

const AccountPendingCreationScreen = function({ getUser, next, user} : { getUser, next, user: MemberAllInfo}) {
    const INITIAL_TIME = 60
    const [seconds, setSeconds] = React.useState(INITIAL_TIME)
    React.useEffect(() => {
        // exit early when we reach 0
        if (!seconds) return;

        const intervalId = setInterval(() => {
            const prev = seconds
            if (seconds === INITIAL_TIME) {
                getUser(user.userInfos.id).catch(console.error);
            }
            if (prev - 1 === 0) {
                setSeconds(INITIAL_TIME)
            } else {
                setSeconds(seconds - 1)
            }
        }, 1000);
        return () => clearInterval(intervalId);
    }, [seconds, user]);

    return <div>
        <h2>Création du compte de {user.userInfos.id}</h2>
        {user && user.primaryEmailStatus !== EMAIL_STATUS_READABLE_FORMAT[EmailStatusCode.EMAIL_ACTIVE] && <>
            <p>Création en cours ...</p>
            <p>Un email informant de la création du compte sera envoyé d'ici 10min</p>
            <p>Recheck automatique d'ici {seconds}s</p>
            <button className="button" onClick={() => next()}>C'est bon {user.userInfos.fullname} as bien reçu l'email</button></>
        }
        {user && user.primaryEmailStatus === EMAIL_STATUS_READABLE_FORMAT[EmailStatusCode.EMAIL_ACTIVE] && <>
            <p className='notification'>
                C'est bon le compte de {user.userInfos.fullname} est actif.
            </p>
            <button className="button" onClick={() => next()}>Passer à l'étape suivante</button>
        </>}
    </div>
}

const isDateInTheFuture = function(date: Date) {
    return date > new Date()
}

export const UpdateEndDatePendingScreen = function({ getUser, user, pullRequestURL, next }) {
    const DEFAULT_TIME = 60
    const [seconds, setSeconds] = React.useState(DEFAULT_TIME)
    const [prStatus, setPRStatus] = React.useState('notMerged')
    const checkPR = async () => {
        try {
            const pullRequests = await axios.get(routes.PULL_REQUEST_GET_PRS).then(resp => resp.data.pullRequests)
            const pullRequestURLs = pullRequests.map(pr => pr.html_url)
            if (!pullRequestURLs.includes(pullRequestURL)) {
                setPRStatus('merged')
                setSeconds(DEFAULT_TIME)
            }
        } catch (e) {

        }
    }

    const checkPRChangesAreApplied = async () => {
        try {
            const data = await getUser(user.userInfos.id)            
            if (isDateInTheFuture(new Date(data.userInfos.end))) {
                setPRStatus('validated')
                setSeconds(DEFAULT_TIME)
                // user date is now in the future
            }
        } catch (e) {
            console.error(e)
        }
    }

    React.useEffect(() => {
        if (isDateInTheFuture(new Date(user.userInfos.end))) {
            setPRStatus('validated')
        }
    }, [user])

    React.useEffect(() => {
        // exit early when we reach 0
        if (!seconds) return;
    
        // save intervalId to clear the interval when the
        // component re-renders
        const intervalId = setInterval(() => {
            const prev = seconds
            if (seconds === DEFAULT_TIME && prStatus === 'notMerged') {
                checkPR()
            }
            if (seconds === DEFAULT_TIME && prStatus === 'merged') {
                checkPRChangesAreApplied()
            }
            if (prev - 1 === 0) {
                setSeconds(DEFAULT_TIME)
            } else {
                setSeconds(seconds - 1)
            }
        }, 1000);
    
        // clear interval on re-render to avoid memory leaks
        return () => clearInterval(intervalId);
        // add seconds as a dependency to re-rerun the effect
        // when we update it
      }, [seconds, prStatus]);

    return <>
        {prStatus === 'notMerged' && <><div className="notification">
            <p>Une pull request en attente : </p>
            <a href={pullRequestURL} target="_blank">{pullRequestURL}</a>
        </div>
        <p>Il faut la merger pour que le changement de date de fin soit prise en compte :</p>
        <p>Suite au merge la prise en compte peut prendre 10 minutes</p></>}
        {prStatus === 'merged' && <>
            <p>La PR a probablement été mergée. Le changement sera pris en compte d'ici quelques minutes, il faut encore attendre :)</p>
        </>}
        {prStatus === 'validated' && <>
            <p>La date de fin est à jour c'est bon on peut passé à l'étape suivante :</p>
            <button className={'button'} onClick={() => next()}>Passer à l'étape suivante</button>
        </>}
        {prStatus !== 'validated' && <p>Recheck dans {seconds} secondes</p>}
    </>
}

export const WhichMemberScreen = function({ setUser, getUser, users }) {
    const [isSearching, setIsSearching] = React.useState(false)

    const search = async (member: string) => {
        setIsSearching(true)
        try {
            const data = await getUser(member)
            setUser(data)
        } catch {
            alert(`Aucune info sur l'utilisateur`)
        }
        setIsSearching(false)
    }

    return <>
            {<form className="no-margin">
                <h2>Qu'est-ce qu'il se passe ?</h2>
                <p>Sélectionne le membre que tu veux aider :</p>
                <div className="form__group">
                    <label><strong>Nom ou prénom du membre</strong></label>
                    <MemberSelect
                        name="username"
                        placeholder="Sélectionner un membre"
                        onChange={(e) => search(e.value)}
                        members={users.map(u => ({
                            value: u.id,
                            label: u.fullname
                        }))}
                        defaultValue={undefined}/>
                </div>
                <div className="form__group">
                    <button className="button no-margin" type="submit" disabled={isSearching}>
                        {!isSearching ? `Voir la fiche` : `Récupération des informations...`}
                    </button>
                </div>
            </form>}
        </>
}


export const CreateEmailScreen = function(props) {
    const [emailValue, setEmailValue] = React.useState(props.secondaryEmail)
    const [isSaving, setIsSaving] = React.useState(false)
    React.useEffect(() => {
        if (props.user.hasEmailInfos) {
            props.next()
        }
    }, [props.user.hasEmailInfos])
    const createEmail = async () => {
        if (isSaving) {
            return
        }
        try {
            const api = routes.USER_CREATE_EMAIL_API.replace(':username', props.user.userInfos.id)
            setIsSaving(false)
            const res = await axios.post(api, {
                to_email: emailValue
            })
            if (res.status === 200) {
                props.next()
            } else {
                throw new Error('Email was not created')
            }
        } catch(e) {
            setIsSaving(false)
            console.error(e)
            alert('Un erreur est survenue')
        }
    }
    const title = `Tu peux créer un compte mail pour ${props.user.userInfos.fullname}.`

    return <ConnectedScreen title={title}><div>
        {!!props.hasPublicServiceEmail && <p>
            Attention s'iel a une adresse de service public en adresse primaire. L'adresse @beta.gouv.fr deviendra son adresse primaire :
            celle à utiliser pour mattermost, et d'autres outils.
        </p>}
        <div className="no-margin">
            <div className="form__group  margin-10-0">
                <label>
                    <span className="text-color-almost-black">Email personnel ou professionnel</span><br />
                    Le mot de passe et les informations de connexion seront envoyées à cet email
                </label>
            <input
                defaultValue={props.secondaryEmail}
                onChange={(event) => {
                    setEmailValue(event.target.value)
                }}
                type="email" required />
            </div>
            <button
                className="button no-margin"
                type="submit"
                disabled={isSaving}
                onClick={createEmail}>Créer un compte</button>
        </div>
    </div></ConnectedScreen>
}

export const WhatIsGoingOnWithMember = PageLayout(function (props: Props) {
    const [step, setStep] = React.useState(STEP.whichMember)
    const [fixes, setFixes] = React.useState([STEP.whichMember, STEP.showMember])
    const [user, setUser] : [MemberAllInfo, (user: MemberAllInfo) => void] = React.useState(undefined)
    const [pullRequestURL, setPullRequestURL] = React.useState('');
    const getUser : (string) => Promise<MemberAllInfo> = async (member) => {
        return await axios.get(routes.API_GET_PUBLIC_USER_INFO.replace(':username', member))
        .then(resp => {
            setUser(resp.data)
            return resp.data
        })
    }

    React.useEffect(() => {
        const state : {
            step: STEP,
            memberId: string,
            user: MemberAllInfo,
            steps: STEP[],
            pullRequestURL: string
        } = JSON.parse(localStorage.getItem('state'))
        if (state) {
            history.pushState({
                step: state.step || STEP.whichMember
            }, '')
            if (state.step) {
                setStep(state.step)
            }
            if (state.steps) {
                setFixes(state.steps)
            }
            if (state.pullRequestURL) {
                setPullRequestURL(state.pullRequestURL)
            }
            if (state.user) {
                setUser(state.user)
                getUser(state.user.userInfos.id).catch(e => {
                    console.error(e)
                })
                
            }
        }
        window.onpopstate = e => {
            setStep(e.state.step)
            //your code...
        }
    }, [])

    function startFix(fixeItems) {
        setFixes(fixeItems)
        next(fixeItems)
    }
    function goBack() {
        const currentStepIndex = fixes.findIndex(s => s === step)
        const nextStep = fixes[currentStepIndex - 1] || STEP.whichMember
        setStep(nextStep)
        const state = {
            step: nextStep,
            memberId: user.userInfos.id,
            user: user,
            steps: fixes
        }
        localStorage.setItem('state', JSON.stringify(state))

    }
    function resetLocalStorage() {
        setStep(STEP.whichMember)
        localStorage.removeItem('state')
    }

    function next(steps?: STEP[], paramUser?: MemberWithPermission) {
        const currentStepIndex = (steps || fixes).findIndex(s => s === step)
        const nextStep = (steps || fixes)[currentStepIndex + 1]
        setStep(nextStep)
        const state = {
            step: nextStep,
            memberId: (paramUser || user).userInfos.id,
            user: paramUser || user,
            steps: (steps || fixes)
        }
        history.pushState(state, '')
        localStorage.setItem('state', JSON.stringify(state))
    }
    let stepView
    if (step === STEP.whichMember) {
        stepView = <WhichMemberScreen
            users={props.users}
            setUser={(user) => {
                setUser(user);
                next([STEP.whichMember, STEP.showMember], user);
            }}
            getUser={getUser}/>
    } else if (step === STEP.showMember) {
        stepView = <MemberComponent
            {...user}
            startFix={startFix}/>
    } else if (step === STEP.updateEndDate) {
        stepView = <UpdateEndDateScreen
            setPullRequestURL={setPullRequestURL}
            user={user}
            next={next} />
    } else if (step === STEP.createEmail) {
        stepView = <CreateEmailScreen
            secondaryEmail={user.secondaryEmail}
            next={next}
            user={user} />
    } else if (step === STEP.accountPendingCreation) {
        stepView = <AccountPendingCreationScreen next={next} user={user} getUser={getUser} />
    } else if (step === STEP.accountCreated) {
        stepView = <div>
            <p>Il faut maintenant que {user.userInfos.fullname} se connecte à l'espace-membre avec son adresse secondaire.</p>
            <p>Un fois dans l'espace membre iel doit définir son mot de passe pour son adresse @beta.gouv.fr dans "changer mot de passe".</p>
            <button className="button" onClick={() => next()}>Passer à l'étape suivante</button>
        </div>
    } else if (step === STEP.everythingIsGood) {
        stepView = <div>
            <p>Tout semble régler pour {user.userInfos.fullname}.</p>
            <button className="button" onClick={resetLocalStorage}>Terminer</button>
        </div>
    } else if (step === STEP.emailSuspended) {
        stepView = <div>
            <p>La de fin de mission de {user.userInfos.fullname} a été mise à jour un peu tard, son email a été suspendu.</p>
            <p>Pour le réactiver, iel doit se connecter a l'espace-membre. Une fois dans l'espace membre iel doit définir son mot de passe pour son adresse @beta.gouv.fr dans "changer mot de passe".</p>
            <p>Iel aura alors de nouveau accès a son email en utilisant ce mdp dans son client email ou sur mail.ovh.net</p>
            <button className="button" onClick={() => next()}>Passer à l'étape suivante</button>
        </div>
    } else if (step === STEP.emailBlocked) {
        stepView = <div>
            <p>{user.userInfos.fullname} a du faire un envoie massif d'email par gmail, ou depuis de nombreuses ips différentes. Son email a été bloqué par OVH.</p>
            <p>Pour le réactiver, iel doit se connecter a l'espace-membre avec son adresse secondaire. Une fois dans l'espace membre iel doit définir son mot de passe pour son adresse @beta.gouv.fr dans "changer mot de passe".</p>
            <p>Iel aura alors de nouveau accès a son email en utilisant ce mdp dans son client email ou sur mail.ovh.net</p>
            <button className="button" onClick={() => next()}>Passer à l'étape suivante</button>
        </div>
    } else if (step === STEP.waitingForDateToBeUpdated) {
        stepView = <UpdateEndDatePendingScreen
            user={user}
            next={next}
            getUser={getUser}
            pullRequestURL={pullRequestURL}/>
    }
    return <div className="container container-small">
        <div className="panel margin-top-m" style={{ minHeight: 500 }}>
            { step !== STEP.whichMember && <a onClick={() => goBack()}>Retour</a>}
            {stepView}
        </div>
    </div>
})

hydrateOnClient(WhatIsGoingOnWithMember) // force one hydration on client
