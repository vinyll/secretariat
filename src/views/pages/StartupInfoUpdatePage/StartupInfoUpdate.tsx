import React from 'react';
import type { Request } from 'express';

import { hydrateOnClient } from '../../hydrateOnClient'
import { InnerPageLayout } from '../components/InnerPageLayout';
import SESelect from '../components/SESelect';
import axios from 'axios';
import { DBPullRequest } from '@/models/pullRequests';
import { StartupInfo } from '@/models/startup';
import SEPhaseSelect from '../components/SEPhaseSelect';
import routes from '@/routes/routes';
import DatepickerSelect from '../components/DatepickerSelect';

interface StartupInfoFormData {
}

interface StartupInfoUpdateProps {
    title: string,
    currentUserId: string,
    errors: string[],
    messages: string[],
    activeTab: string,
    request: Request,
    formData: StartupInfoFormData,
    startupsInfos: StartupInfo[]
    formValidationErrors: any,
    startupOptions: {
        value: string,
        label: string
    }[],
    username: string,
    updatePullRequest?: DBPullRequest
}

interface FormErrorResponse {
    errors?: Record<string,string[]>
    message: string
}

function getCurrentPhase(startup : StartupInfo) {
    return startup.attributes.phases ? startup.attributes.phases[startup.attributes.phases.length - 1].name : undefined
}

const PHASE_READABLE_NAME = {
    'acceleration': 'En Accélération',
    'investigation': 'En Investigation',
    'transfert': 'Transférée',
    'construction': 'En Construction',
    'alumni': 'Partenariat terminé',
    'success': 'Pérennisé'
}


/* Pure component */
export const StartupInfoUpdate = InnerPageLayout((props: StartupInfoUpdateProps) => {
    const [startup, setStartup] = React.useState('')
    const [phase, setPhase] = React.useState('')
    const [date, setDate] = React.useState((new Date()))
    const [formErrors, setFormErrors] = React.useState({});
    const [errorMessage, setErrorMessage] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false)


    const css = ".panel { overflow: hidden; width: auto; min-height: 100vh; }"

    const save = async (event) => {
        event.preventDefault();
        setIsSaving(true)
        axios.post(routes.STARTUP_POST_INFO_UPDATE_FORM.replace(':startup', startup), {
            phase,
            date
        }).then(() => {
            window.location.replace('/account');
        }).catch(({ response: { data }} : { response: { data: FormErrorResponse }}) => {
            const ErrorResponse : FormErrorResponse = data
            setErrorMessage(ErrorResponse.message)
            setIsSaving(false)
            if (ErrorResponse.errors) {
                setFormErrors(ErrorResponse.errors)
            }
        })
    }
    const startupInfo : StartupInfo = startup ? props.startupsInfos.find(s => s.id === startup) : null
    return (
        <>
            <div className="module">
            <div>
                <small>
                    <a href="/account">Produit</a> &gt; <a href="">Mise à jour de la phase</a>
                </small>
            </div>
            <div className="margin-top-m"></div>
            <div className="panel">
                    <h3>Mise à jour des informations de mon produit</h3>
                    { !!props.updatePullRequest && <div className="notification">
                            ⚠️ Une pull request existe déjà sur cette startup. Quelqu'un doit la merger pour que le changement soit pris en compte.
                            <a href={props.updatePullRequest.url} target="_blank">{props.updatePullRequest.url}</a>
                            <br/>(la prise en compte peut prendre 10 minutes.)
                        </div>
                    }
                    { !!errorMessage && 
                        <p className="text-small text-color-red">{errorMessage}</p>
                    }
                    <div className="beta-banner"></div>
                    <div>
                        <div className="form__group">
                            <label htmlFor="startup">
                                <strong>Quel startup veux tu modifier ?</strong><br />
                            </label>
                            <SESelect
                                startups={props.startupOptions}
                                onChange={(startup) => {
                                    setStartup(startup.value)
                                }}
                                isMulti={false}
                                placeholder={"Selectionne ta startup"}
                            />
                            { !!formErrors['gender'] && 
                                <p className="text-small text-color-red">{formErrors['startups']}</p>
                            }
                        </div>
                        {startupInfo && <>
                            <h3>Produit : </h3>
                            <p className="font-weight-bold">Nom : <span className='font-weight-bold text-color-blue'>{startupInfo.attributes.name}</span></p>
                            <p><b>Mission</b> : {startupInfo.attributes.pitch}</p>
                            <p>
                                <b>Phase actuelle :</b> { PHASE_READABLE_NAME[getCurrentPhase(startupInfo)]}
                            </p>
                            <h3>Mettre à jour la phase :</h3>
                            <form className='no-margin' onSubmit={save}>
                                <div className="form__group">
                                    <label htmlFor="startup">
                                        <strong>Dans quelles phase se trouve {startupInfo.attributes.name} actuellement ?</strong><br />
                                    </label>
                                    <SEPhaseSelect
                                        onChange={(phase) => {
                                            setPhase(phase.value)
                                        }}
                                        defaultValue={getCurrentPhase(startupInfo)}
                                        isMulti={false}
                                        placeholder={"Selectionne la phase"}
                                    />
                                </div>
                                <div className="form__group">
                                    <label htmlFor="end">
                                        <strong>Depuis quand ?</strong><br />
                                        <i>Au format JJ/MM/YYYY</i>
                                    </label>
                                    <DatepickerSelect
                                        name="endDate"
                                        min={'2020-01-31'}
                                        title="En format YYYY-MM-DD, par exemple : 2020-01-31" required
                                        dateFormat='dd/MM/yyyy'
                                        selected={date}
                                        onChange={(dateInput:Date) => setDate(dateInput)} />
                                    { !!formErrors['nouvelle date de fin'] && 
                                        <p className="text-small text-color-red">{formErrors['nouvelle date de fin']}</p>
                                    }
                                </div>
                                <input
                                    type="submit"
                                    disabled={isSaving}
                                    value={isSaving ? `Enregistrement en cours...` : `Enregistrer`}
                                    className="button"
                                />
                            </form>
                        </>}
                    </div>
                </div>
            </div>
            <style media="screen">
                {css}
            </style>
        </>
    )
})

hydrateOnClient(StartupInfoUpdate)