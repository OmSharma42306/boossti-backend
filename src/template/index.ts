import slugify from 'slugify';
import { DB } from '../utils/DB';
import Template from './utils/templateModel';
import Page from './utils/pageModel';
import { getCurrentUser } from '../utils/authentication';
import { AppSyncEvent } from '../utils/cutomTypes';
// import getAdminFilter from '../utils/adminFilter';
import { userPopulate } from '../utils/populate';
import { User } from '../user/utils/userModel';

const pagePopulate = [
  userPopulate,
  { path: 'template', select: 'title slug' },
  {
    path: 'fields.typeId',
    select: 'title description media slug',
  },
  {
    path: 'fields.form',
    select: 'name',
  },
  {
    path: 'values.itemId',
    select: 'template title media slug',
  },
  {
    path: 'values.response',
    select: 'values',
  },
];
const templatePopulate = [
  userPopulate,
  {
    path: 'fields.typeId',
    select: 'title description media slug',
  },
  {
    path: 'fields.form',
    select: 'name',
  },
];

export const handler = async (event: AppSyncEvent): Promise<any> => {
  try {
    await DB();
    const { fieldName } = event.info;
    const { identity } = event;
    const user = await getCurrentUser(identity);
    let args = { ...event.arguments };
    if (fieldName.toLocaleLowerCase().includes('create') && user && user._id) {
      args = { ...args, createdBy: user._id };
    } else if (fieldName.toLocaleLowerCase().includes('update') && user && user._id) {
      args = { ...args, updatedBy: user._id };
    }

    if (
      Object.prototype.hasOwnProperty.call(args, 'title') &&
      fieldName.toLocaleLowerCase().includes('create')
    ) {
      args = { ...args, slug: slugify(args.title, { lower: true }) };
    }

    if (
      Object.prototype.hasOwnProperty.call(args, 'slug') &&
      fieldName.toLocaleLowerCase().includes('update')
    ) {
      args = { ...args, slug: slugify(args.slug, { lower: true }) };
    }

    switch (fieldName) {
      case 'getTemplates': {
        const { page = 1, limit = 20, search = '', active = null } = args;
        const tempFilter: any = {};
        if (active !== null) {
          tempFilter.active = active;
        }
        const data = await Template.find({
          ...tempFilter,
          title: { $regex: search, $options: 'i' },
        })
          .populate(templatePopulate)
          .limit(limit * 1)
          .skip((page - 1) * limit);
        const count = await Template.countDocuments({
          ...tempFilter,
          title: { $regex: search, $options: 'i' },
        });
        return {
          data,
          count,
        };
      }
      case 'getMenuTemplates': {
        return await Template.find({
          showInMenu: true,
          active: true,
        }).select('title slug');
      }
      case 'getMentionItems': {
        const { search = '' } = args;
        let pages: any = await Page.find({
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        })
          .populate(pagePopulate)
          .limit(5);

        pages = pages.map(
          (val) =>
            (val = {
              title: val.title,
              _id: val._id,
              category: val.template[0].title,
              type: 'page',
            }),
        );

        let users: any = await User.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }).limit(5);

        users = users.map(
          (val) => (val = { title: val.name, _id: val._id, category: val.email, type: 'user' }),
        );
        const combinedItems = pages.concat(users);
        return combinedItems;
      }
      case 'getPageMentions': {
        const { page = 1, _id, limit = 20, parentId, field, onlyShowByUser = null } = args;
        const tempFilter: any = {};
        if (onlyShowByUser) {
          tempFilter.createdBy = user._id;
        }
        const data = await Page.find({
          'fields.options.values.value': { $regex: `data-id="${_id}"`, $options: 'i' },
        })
          .populate(pagePopulate)
          .limit(limit * 1)
          .skip((page - 1) * limit);
        const count = await Page.countDocuments({
          ...tempFilter,
          parentId,
          field,
        });
        return {
          data,
          count,
        };
      }
      case 'getTemplateBySlug': {
        return await Template.findOne({ slug: args.slug }).populate(templatePopulate);
      }
      case 'getTemplate': {
        return await Template.findById(args._id).populate(templatePopulate);
      }
      case 'createTemplate': {
        let count = 1;
        args = { ...args, count, slug: count };
        const lastTemplate = await Template.findOne().sort('-count');
        if (lastTemplate) {
          count = lastTemplate?.count + 1;
          args = { ...args, count, slug: count };
        }
        const template = await Template.create(args);
        return await template.populate(templatePopulate).execPopulate();
      }
      case 'updateTemplate': {
        const template: any = await Template.findByIdAndUpdate(args._id, args, {
          new: true,
          runValidators: true,
        });
        return await template.populate(templatePopulate).execPopulate();
      }
      case 'deleteTemplate': {
        const count = await Page.countDocuments({
          template: args._id,
        });
        if (count > 0) {
          throw new Error('First delete the items under this type');
        }
        await Template.findByIdAndDelete(args._id);
        return args._id;
      }
      case 'getPages': {
        const { page = 1, limit = 20, search = '', active = null, template = null } = args;
        const tempFilter: any = {};
        if (active !== null) {
          tempFilter.active = active;
        }
        if (template) {
          tempFilter.template = template;
        }
        // const adminFilter = getAdminFilter(identity, user);
        const data = await Page.find({
          ...tempFilter,
          // ...adminFilter,
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        })
          .populate(pagePopulate)
          .limit(limit * 1)
          .skip((page - 1) * limit);
        const count = await Page.countDocuments({
          ...tempFilter,
          // ...adminFilter,
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        });
        return {
          data,
          count,
        };
      }
      case 'getPageBySlug': {
        return await Page.findOne({ slug: args.slug }).populate(pagePopulate);
      }
      case 'getPage': {
        return await Page.findById(args._id).populate(pagePopulate);
      }
      case 'createPage': {
        const page = await Page.create(args);
        return await page.populate(pagePopulate).execPopulate();
      }
      case 'updatePage': {
        const page: any = await Page.findByIdAndUpdate(args._id, args, {
          new: true,
          runValidators: true,
        });
        return await page.populate(pagePopulate).execPopulate();
      }
      case 'deletePage': {
        await Page.findByIdAndDelete(args._id);
        return args._id;
      }
      default:
        throw new Error('Something went wrong! Please check your Query or Mutation');
    }
  } catch (error) {
    const error2 = error;
    throw error2;
  }
};
