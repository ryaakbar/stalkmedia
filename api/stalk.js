import axios from "axios";
import * as cheerio from "cheerio";
import needle from "needle";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";

class RobloxAPI {
  constructor() {
    this.baseUrl = "https://api.roblox.com";
  }

  async request(url, method = "GET", data = null, timeout = 10000) {
    try {
      const config = { method, url, timeout };
      if (data) config.data = data;
      const finalUrl = url.startsWith("http") ? url : this.baseUrl + url;
      config.url = finalUrl;
      const response = await axios(config);
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getUserIdFromUsername(username) {
    const data = await this.request("https://users.roblox.com/v1/usernames/users", "POST", {
      usernames: [username],
      excludeBannedUsers: false,
    });
    return data?.data?.[0]?.id || null;
  }

  async getUserInfo(userId) {
    return await this.request(`https://users.roblox.com/v1/users/${userId}`);
  }

  async getUserFriendsCount(userId) {
    return await this.request(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
  }

  async getUserFollowersCount(userId) {
    return await this.request(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
  }

  async getUserFollowingCount(userId) {
    return await this.request(`https://friends.roblox.com/v1/users/${userId}/followings/count`);
  }

  async getUserAvatarHeadshot(userId, size = "420x420", format = "Png") {
    const res = await this.request(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=${size}&format=${format}&isCircular=false`);
    return res?.data?.[0]?.imageUrl || null;
  }

  async getCompleteUserInfo(username) {
    const userId = await this.getUserIdFromUsername(username);
    if (!userId) throw new Error("Roblox User not found");

    const [
      basic,
      friendsCount,
      followersCount,
      followingCount,
      headshot
    ] = await Promise.all([
      this.getUserInfo(userId),
      this.getUserFriendsCount(userId),
      this.getUserFollowersCount(userId),
      this.getUserFollowingCount(userId),
      this.getUserAvatarHeadshot(userId)
    ]);

    return {
      id: userId,
      username: basic.name,
      nickname: basic.displayName,
      bio: basic.description,
      created: basic.created,
      profile_pic: headshot,
      stats: {
        friends: friendsCount?.count || 0,
        followers: followersCount?.count || 0,
        following: followingCount?.count || 0
      },
      url: `https://www.roblox.com/users/${userId}/profile`
    };
  }
}

const Roblox = new RobloxAPI();

async function tiktokStalk(user) {
  try {
    const url = `https://www.tiktok.com/@${user}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Referer": "https://www.tiktok.com/"
      },
      timeout: 10000,
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    const dataScript = $("#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
    if (dataScript) {
        const json = JSON.parse(dataScript);
        const defaultScope = json["__DEFAULT_SCOPE__"];
        const userDetail = defaultScope?.["webapp.user-detail"];
        
        if (userDetail?.statusCode === 0 && userDetail?.userInfo) {
            const u = userDetail.userInfo;
            return {
                uniqueId: u.user.uniqueId,
                nickname: u.user.nickname,
                avatarLarger: u.user.avatarLarger,
                signature: u.user.signature,
                verified: u.user.verified,
                stats: {
                    followerCount: u.stats.followerCount,
                    followingCount: u.stats.followingCount,
                    heartCount: u.stats.heartCount
                }
            };
        }
    }

    const sigiScript = $('script#SIGI_STATE').text();
    if (sigiScript) {
        const json = JSON.parse(sigiScript);
        const userModule = json.UserModule;
        if (userModule && userModule.users && userModule.users[user]) {
            const u = userModule.users[user];
            const s = userModule.stats[user];
            return {
                uniqueId: u.uniqueId,
                nickname: u.nickname,
                avatarLarger: u.avatarLarger,
                signature: u.signature,
                verified: u.verified,
                stats: {
                    followerCount: s.followerCount,
                    followingCount: s.followingCount,
                    heartCount: s.heartCount
                }
            };
        }
    }
    
    throw new Error("User data not found in page");
  } catch (err) {
    throw new Error(err.message || "TikTok User not found");
  }
}

async function githubStalk(user) {
  try {
    const { data } = await axios.get("https://api.github.com/users/" + user);
    return {
      username: data.login,
      nickname: data.name || data.login,
      bio: data.bio || "No bio",
      profile_pic: data.avatar_url,
      url: data.html_url,
      stats: {
        followers: data.followers || 0,
        following: data.following || 0,
        repos: data.public_repos || 0
      }
    };
  } catch (error) {
    throw new Error("GitHub user not found");
  }
}

async function instagramStalk(username) {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, withCredentials: true }));
    const igCookie = "csrftoken=osAtGItPXdetQOXtk2IlfZ; datr=ygJMaBFtokCgDHvSHpjRBiXR; ig_did=4AFB2614-B27A-463C-88D7-634A167A23D1; wd=1920x1080; mid=aEwCygALAAHnO0uXycs4-HkvZeZG;"; 

    try {
        const response = await client.get(
            `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
            {
                headers: {
                    authority: "www.instagram.com",
                    "user-agent": "Mozilla/5.0 (Linux; Android 9; GM1903 Build/PKQ1.190110.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/75.0.3770.143 Mobile Safari/537.36 Instagram 103.1.0.15.119 Android (28/9; 420dpi; 1080x2260; OnePlus; GM1903; OnePlus7; qcom; en_US; 162830167)",
                    "x-ig-app-id": "936619743392459",
                    cookie: igCookie
                }
            }
        );
        const user = response.data?.data?.user;
        if (!user) throw new Error("No user data");

        return {
            username: user.username,
            nickname: user.full_name || user.username,
            bio: user.biography,
            profile_pic: user.profile_pic_url,
            is_verified: user.is_verified,
            stats: {
                followers: user.edge_followed_by?.count || 0,
                following: user.edge_follow?.count || 0,
                posts: user.edge_owner_to_timeline_media?.count || 0
            }
        };
    } catch (error) {
        throw new Error("Instagram Profile not found");
    }
}

async function pinterestStalk(username) {
    try {
        const { data } = await axios.get("https://www.pinterest.com/resource/UserResource/get/", {
            params: {
                source_url: `/${username}/`,
                data: JSON.stringify({
                    options: { username, field_set_key: "profile", isPrefetch: false },
                    context: {},
                }),
                _: Date.now(),
            },
            headers: { "User-Agent": "Postify/1.0.0" }
        });

        if (!data.resource_response?.data) throw new Error("User not found");
        const user = data.resource_response.data;
        
        return {
            username: user.username,
            nickname: user.full_name || user.username,
            bio: user.about,
            profile_pic: user.image_xlarge_url,
            is_verified: user.verified_identity,
            stats: {
                followers: user.follower_count || 0,
                following: user.following_count || 0,
                pins: user.pin_count || 0
            }
        };
    } catch (error) {
        throw new Error("Pinterest User not found");
    }
}

async function twitterStalk(username) {
    try {
        const response = await axios.get(
            `https://x.com/i/api/graphql/32pL5BWe9WKeSK1MoPvFQQ/UserByScreenName?variables=%7B%22screen_name%22%3A%22${username}%22%7D&features=%7B%22hidden_profile_subscriptions_enabled%22%3Atrue%2C%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22subscriptions_verification_info_is_identity_verified_enabled%22%3Atrue%2C%22subscriptions_verification_info_verified_since_enabled%22%3Atrue%2C%22highlights_tweets_tab_ui_enabled%22%3Atrue%2C%22responsive_web_twitter_article_notes_tab_enabled%22%3Atrue%2C%22subscriptions_feature_can_gift_premium%22%3Atrue%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D`,
            {
                headers: {
                    authorization: "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
                    cookie: 'guest_id=v1%3A173113403636768133;',
                    "x-csrf-token": "a0b42c9fa97da6bf8505d9fd66cbe549c3b4a33d028d877fb0ae9a1d1b61d814fa831a4f097249ee4dea9a41f5050d12bda9806ce1816e5522572b2f0a81a3bc4f9a9bd2f2fdf4edef38a7759d03648f"
                }
            }
        );
        
        const userData = response.data?.data?.user?.result;
        if (!userData) throw new Error("No data");
        const legacy = userData.legacy;
        
        return {
            username: legacy.screen_name,
            nickname: legacy.name,
            bio: legacy.description,
            profile_pic: legacy.profile_image_url_https?.replace("_normal", "_400x400"),
            is_verified: userData.is_blue_verified,
            stats: {
                followers: legacy.followers_count,
                following: legacy.friends_count,
                tweets: legacy.statuses_count
            }
        };
    } catch (error) {
        throw new Error("Twitter user not found");
    }
}

async function youtubeStalk(username) {
    try {
        const response = await needle('get', `https://youtube.com/@${username}`, { follow_max: 5 });
        const $ = cheerio.load(response.body);
        const script = $('script').filter((i, el) => $(el).html().includes('var ytInitialData =')).html();
        if(!script) throw new Error("Script missing");
        const json = JSON.parse(script.match(/var ytInitialData = (.*?);/)[1]);
        
        const header = json.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
        const metadata = header?.metadata?.contentMetadataViewModel?.metadataRows;
        
        let subCount = "0";
        let vidCount = "0";

        if (metadata) {
            metadata.forEach(row => {
               row.metadataParts.forEach(part => {
                   if(part.text?.content?.includes('subscribers')) subCount = part.text.content;
                   if(part.text?.content?.includes('videos')) vidCount = part.text.content;
               });
            });
        }

        return {
            username: header?.title?.content || username,
            nickname: header?.title?.content,
            bio: header?.metadata?.contentMetadataViewModel?.metadataRows[0]?.metadataParts[0]?.text?.content || "Youtube Channel",
            profile_pic: header?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources[0]?.url,
            is_verified: true, 
            stats: {
                subscribers: subCount,
                videos: vidCount,
                views: "N/A"
            }
        };
    } catch (error) {
        throw new Error("Channel not found");
    }
}

async function robloxStalk(user) {
    try {
        return await Roblox.getCompleteUserInfo(user);
    } catch (e) {
        throw new Error(e.message || "Roblox user not found");
    }
}

export default async function handler(req, res) {
  const { username, type = "tiktok" } = req.query;

  if (!username) {
    return res.status(400).json({ status: false, error: "Username is required" });
  }

  const cleanUser = username.replace('@', '').trim();
  let result;

  try {
    switch (type.toLowerCase()) {
        case 'tiktok': result = await tiktokStalk(cleanUser); break;
        case 'github': result = await githubStalk(cleanUser); break;
        case 'instagram': result = await instagramStalk(cleanUser); break;
        case 'pinterest': result = await pinterestStalk(cleanUser); break;
        case 'twitter': result = await twitterStalk(cleanUser); break;
        case 'youtube': result = await youtubeStalk(cleanUser); break;
        case 'roblox': result = await robloxStalk(cleanUser); break;
        default: throw new Error("Platform not supported");
    }

    return res.status(200).json({
      status: true,
      platform: type,
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      error: error.message || "Internal Server Error"
    });
  }
}
