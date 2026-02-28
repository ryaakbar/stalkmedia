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
    try {
        // Try scraping public page
        const url = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
        const response = await axios.get(`https://www.instagram.com/${username}/`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 10000,
        });
        const html = response.data;
        
        // Extract from meta tags
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        const descMatch = html.match(/<meta property="og:description" content="(.*?)"/);
        const imgMatch = html.match(/<meta property="og:image" content="(.*?)"/);
        
        const title = titleMatch ? titleMatch[1] : username;
        const desc = descMatch ? descMatch[1] : "";
        
        // Parse followers from description like "1.2M Followers, 500 Following, 100 Posts"
        const followersMatch = desc.match(/([\d,.]+[KMB]?)\s*Followers/i);
        const followingMatch = desc.match(/([\d,.]+[KMB]?)\s*Following/i);
        const postsMatch = desc.match(/([\d,.]+[KMB]?)\s*Posts/i);
        
        const nickname = title.replace(/\(@.*?\).*/, "").replace("• Instagram", "").trim();
        
        return {
            username: username,
            nickname: nickname || username,
            bio: desc.split(" - ")[1] || "No bio.",
            profile_pic: imgMatch ? imgMatch[1] : null,
            is_verified: false,
            stats: {
                followers: followersMatch ? followersMatch[1] : "N/A",
                following: followingMatch ? followingMatch[1] : "N/A",
                posts: postsMatch ? postsMatch[1] : "N/A"
            }
        };
    } catch (error) {
        throw new Error("Instagram Profile not found or is private");
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
        // Scrape public Twitter/X page
        const response = await axios.get(`https://x.com/${username}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 10000,
        });
        
        const html = response.data;
        const $ = cheerio.load(html);
        
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        const descMatch = html.match(/<meta property="og:description" content="(.*?)"/);
        const imgMatch = html.match(/<meta property="og:image" content="(.*?)"/);
        
        const title = titleMatch ? titleMatch[1].replace(" / X", "").trim() : username;
        const desc = descMatch ? descMatch[1] : "";
        
        const followersMatch = desc.match(/([\d,.]+[KMB]?)\s*Followers/i);
        const followingMatch = desc.match(/([\d,.]+[KMB]?)\s*Following/i);
        const tweetsMatch = desc.match(/([\d,.]+[KMB]?)\s*(?:Tweets|Posts)/i);
        
        return {
            username: username,
            nickname: title || username,
            bio: desc || "No bio.",
            profile_pic: imgMatch ? imgMatch[1] : null,
            is_verified: false,
            stats: {
                followers: followersMatch ? followersMatch[1] : "N/A",
                following: followingMatch ? followingMatch[1] : "N/A",
                tweets: tweetsMatch ? tweetsMatch[1] : "N/A"
            }
        };
    } catch (error) {
        throw new Error("Twitter/X user not found");
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
