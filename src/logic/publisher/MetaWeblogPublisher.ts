/**
 * 基于MetaWeblog接口的博客发布器，支持WordPress等博客
 *
 * https://codex.wordpress.org/XML-RPC_MetaWeblog_API#metaWeblog.newPost
 * http://xmlrpc.scripting.com/metaWeblogApi.html
 * https://github.com/uhavemyword/metaweblog-api
 *
 * Created by jzj on 2018/12/24.
 */

'use strict';

import MetaWeblog from 'metaweblog-api';

import { FileCache, PostCache } from './PublishCache';
import { checkUrlValid, getMimeType, BasePublisher, readFileBits } from './BasePublisher';

/**
 * 基于MetaWeblog接口的博客发布器
 */
export class MetaWeblogPublisher extends BasePublisher {
  metaWeblog: any;
  blogId: string;
  username: string;
  password: string;
  postCache: any;
  mediaCache: any;
  constructor(url: any, username: any, password: any) {
    super();
    this.metaWeblog = new MetaWeblog(url);
    this.blogId = '';
    this.username = username;
    this.password = password;
    this.postCache = new PostCache(url, username);
    this.mediaCache = new FileCache(url, username);
    // console.log(url, username)
  }

  async getOldPost(post: any) {
    const oldPostId = await this.postCache.get(post);
    if (oldPostId) {
      console.log('metaweblog old post id', oldPostId);
      const oldPost = await this.metaWeblog.getPost(oldPostId, this.username, this.password).catch(() => null);
      console.log('metaweblog old post', oldPost);
      // noinspection EqualityComparisonWithCoercionJS
      if (oldPost && oldPost.postid == oldPostId) {
        return this.toPost(oldPost);
      }
    }
    return null;
  }

  async newPost(post: any) {
    const _post = await this.toMetaWeblogPost(post);
    const id = await this.metaWeblog.newPost(this.blogId, this.username, this.password, _post, true);
    await this.postCache.put(post, id);
    return id;
  }

  async editPost(oldPost: any, post: any) {
    const _post = await this.toMetaWeblogPost(post);
    const id = oldPost.id;
    await this.metaWeblog.editPost(id, this.username, this.password, _post, true); // return true
    await this.postCache.put(post, id);
    return id;
  }

  // noinspection JSMethodCanBeStatic
  toPost(mateWeblogPost: any) {
    return {
      id: mateWeblogPost.postid,
      title: mateWeblogPost.title,
      html: mateWeblogPost.description
    };
  }

  // noinspection JSMethodCanBeStatic
  async toMetaWeblogPost(post: any) {
    // await this.checkCategoryExists(post)
    return {
      title: post.title,
      description: post.html,
      post_type: 'post',
      dateCreated: post.date,
      categories: post.categories,
      mt_keywords: post.tags,
      mt_excerpt: post.abstract,
      wp_slug: post.url,
      post_status: 'publish'
    };
  }

  async checkCategoryExists(post: any) {
    if (post.categories && post.categories.length > 0) {
      const oldCats = await this.metaWeblog.getCategories(this.blogId, this.username, this.password);
      for (let i = 0; i < post.categories; i++) {
        const catName = post.categories[i];
        if (oldCats.findIndex((cat: any) => cat.description === catName) === -1) {
          return false;
        }
      }
    }
    return true;
  }

  async uploadMedia(file: any, mediaMode: any) {
    if (mediaMode === 'cache') {
      const url = await this.mediaCache.get(file);
      if (await checkUrlValid(url)) {
        console.log(`use cached media: ${file} ==> ${url}`);
        return url;
      }
    }
    const bits = await readFileBits(file);
    const mediaObject = {
      name: window.api.pathBasename(file),
      type: getMimeType(file),
      bits: bits,
      overwrite: false
    };
    const result = await this.metaWeblog.newMediaObject(this.blogId, this.username, this.password, mediaObject);
    const { id, url, type } = result;
    await this.mediaCache.put(file, url);
    console.log(`media uploaded: ${file} ==> ${url}`);
    return url;
  }
}
