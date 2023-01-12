import { addEvent, EventCode } from '@/lib/events'
import betagouv from "@/betagouv";
import { PRInfo } from "@/lib/github";
import db from "@/db";
import { PULL_REQUEST_TYPE, PULL_REQUEST_STATE } from "@/models/pullRequests";
import { requiredError } from '@/controllers/validator';
import { StartupInfo } from '@/models/startup';
import { GithubStartupChange, updateStartupGithubFile } from '../helpers/githubHelpers';

export async function postStartupInfoUpdate(req, res) {
    const { startup } = req.params;
    
    try {
        const formValidationErrors = {};
        const errorHandler = (field, message) => {
            const errorMessagesForKey = formValidationErrors[field] || []
            // add new message to array
            errorMessagesForKey.push(message)
            // make it one message
            formValidationErrors[field] = errorMessagesForKey
        }
        const phase = req.body.phase || requiredError('phase', errorHandler)
        const date = req.body.date || requiredError('date', errorHandler)


        if (Object.keys(formValidationErrors).length) {
            throw new Error('Erreur dans le formulaire', { cause: formValidationErrors });
        }
 
        const startupsInfos = await betagouv.startupsInfos()
        const info : StartupInfo = startupsInfos.find(s => s.id === startup)
        const phases = info.attributes.phases.map(phase => ({
            ...phase,
            end: phase.end ? new Date(phase.end) : undefined,
            start: phase.start ? new Date(phase.start) : undefined,
        }))
        phases[phases.length-1].end = date
        phases.push({
            name: phase,
            start: date,
            end: undefined
        })
        const changes : GithubStartupChange = { phases };
        const prInfo : PRInfo = await updateStartupGithubFile(startup, changes);
        addEvent(EventCode.STARTUP_PHASE_UPDATED, {
            created_by_username: req.auth.id,
            action_metadata: { 
                value: {
                    phase: phase,
                    date: date,
                }
            }
        })
        await db('pull_requests').insert({
            url: prInfo.html_url,
            type: PULL_REQUEST_TYPE.PR_TYPE_STARTUP_UPDATE,
            status: PULL_REQUEST_STATE.PR_STARTUP_UPDATE_CREATED,
            info: JSON.stringify(changes)
        })
        const message = `⚠️ Pull request pour la mise à jour de la fiche de ${startup} ouverte. 
        \nUn membre de l'equipe doit merger la fiche : <a href="${prInfo.html_url}" target="_blank">${prInfo.html_url}</a>. 
        \nUne fois mergée, la fiche sera mis à jour dans les 10 minutes.`
        req.flash('message', message);
        res.json({
            message,
            pr_url: prInfo.html_url
        });
    } catch (err) {
        res.status(400).json({
            message: err.message,
            errors: err.cause,
        });
    }
}