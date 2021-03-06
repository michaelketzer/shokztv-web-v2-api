import { Router, Request, Response } from 'express';
import { getMainEvent, getEvents, deleteEvent, changeMainEvent, toggleFeatureEvent, createEvent, upadteEvent, getAllEvents, getFeaturedEvents, getEventRelations, getEventSlugs } from '../../services/event';
import { getArrayFromBody } from './helper';
import { UploadedFile } from 'express-fileupload';
import { checkUserRole } from '../../middlewares/access';

const route = Router();

export default (app: Router) => {
    app.use('/event', route);

    route.get('/main', async (req: Request, res: Response) => {
        const mainEvent = await getMainEvent();
        return res.json(mainEvent).status(200);
    });

    route.get('/featured', async (req: Request, res: Response) => {
        const events = await getFeaturedEvents();
        return res.json(events).status(200);
    });

    route.get('/pastSlugs', async (req: Request, res: Response) => {
        const eventIds = await getEventSlugs();
        return res.json(eventIds).status(200);
    });

    route.get('/relations/:eventId', async (req: Request, res: Response) => {
        const relations = await getEventRelations(+req.params.eventId);
        return res.send(relations).status(200);
    });

    route.get('/bySlug', async (req: Request, res: Response) => {
        const events = await getEvents(req.query.slugs as string[]);
        return res.json(events).status(200);
    });
    
    route.get('/list', checkUserRole('ADMIN_ACCESS'),async (req: Request, res: Response) => {
        const events = await getAllEvents();
        return res.json(events).status(200);
    });
    
    route.post('/create', checkUserRole('EVENT_CREATE'), async (req: Request, res: Response) => {
        const {
            name,
            organizer,
            descriptionShort = '', 
            start,
            end,
            country = '',
            location = '',
            pricePool = '',
            description = '',
            descriptionType = 'description',
            disclaimer = '',
            slug = '',
        } = req.body;
        const tags = getArrayFromBody(req.body.tags);
        const links = getArrayFromBody(req.body.links);
        const {banner = null, organizationLogo = null} = req.files || {};
        const eventId = await createEvent(
            name,
            organizer,
            descriptionShort,
            start,
            end,
            country,
            location,
            pricePool,
            description,
            descriptionType,
            disclaimer,
            banner as UploadedFile,
            organizationLogo as UploadedFile,
            tags,
            links,
            slug
        );
        return res.json(eventId).status(200);
    });

    route.patch('/:eventId', checkUserRole('EVENT_EDIT'), async (req: Request, res: Response) => {
        const {
            name,
            organizer,
            descriptionShort, 
            start,
            end,
            country,
            location,
            pricePool,
            description,
            descriptionType,
            disclaimer,
            slug
        } = req.body;
        const tags = getArrayFromBody(req.body.tags);
        const links = getArrayFromBody(req.body.links);
        const {banner = null, organizerLogo = null} = req.files || {};
        await upadteEvent(
            +req.params.eventId,
            name,
            organizer,
            descriptionShort,
            start,
            end,
            country,
            location,
            pricePool,
            description,
            descriptionType,
            disclaimer,
            banner as UploadedFile | undefined,
            organizerLogo as UploadedFile | undefined,
            tags,
            links,
            slug,
        );
        return res.send().status(204);
    });
    
    route.put('/unfeature/:eventId', checkUserRole('EVENT_FEATURE'), async (req: Request, res: Response) => {
        await toggleFeatureEvent(+req.params.eventId, false);
        return res.send().status(204);
    });
    
    route.put('/feature/:eventId', checkUserRole('EVENT_FEATURE'), async (req: Request, res: Response) => {
        await toggleFeatureEvent(+req.params.eventId, true);
        return res.send().status(204);
    });

    route.put('/mainEvent/:eventId', checkUserRole('EVENT_MAIN_EVENT'), async (req: Request, res: Response) => {
        await changeMainEvent(+req.params.eventId);
        return res.send().status(204);
    });
    
    route.delete('/:eventId', checkUserRole('EVENT_DELETE'), async (req: Request, res: Response) => {
        await deleteEvent(+req.params.eventId);
        return res.send().status(204);
    });
};