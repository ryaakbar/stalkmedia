import axios from "axios";
import * as cheerio from "cheerio";
import needle from "needle";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";

// ============================================
//   ROBLOX API CLASS
// ============================================
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

    const [basic, friendsCount, followersCount, followingCount, headshot] = await Promise.all([
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
      bio: basic.description || "No bio.",
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

// ============================================
//   TIKTOK
// ============================================
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
      if (userModule?.users?.[user]) {
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

// ============================================
//   GITHUB
// ============================================
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

// ============================================
//   INSTAGRAM - scrape public page meta tags
// ============================================
async function instagramStalk(username) {
  try {
    // Try imginn.com as proxy (public Instagram data)
    const response = await axios.get(`https://imginn.com/${username}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 12000,
    });

    const $ = cheerio.load(response.data);

    const name = $('h1.name').text().trim() || $('title').text().split('(')[0].trim();
    const username_el = $('span.username').text().trim().replace('@', '') || username;
    const bio = $('div.desc').text().trim() || "No bio.";
    const avatar = $('div.profile-pic img').attr('src') || $('img.avatar').attr('src') || null;

    const followers = $('li:contains("followers") span').text().trim() || 
                      $('div.counts').find('li').eq(0).find('span').text().trim() || "N/A";
    const following = $('li:contains("following") span').text().trim() ||
                      $('div.counts').find('li').eq(1).find('span').text().trim() || "N/A";
    const posts = $('li:contains("posts") span').text().trim() ||
                  $('div.counts').find('li').eq(2).find('span').text().trim() || "N/A";

    return {
      username: username_el || username,
      nickname: name || username,
      bio: bio,
      profile_pic: avatar,
      is_verified: false,
      stats: {
        followers: followers,
        following: following,
        posts: posts
      }
    };
  } catch (error) {
    // Fallback: scrape Instagram directly via meta tags
    try {
      const resp = await axios.get(`https://www.instagram.com/${username}/`, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 10000,
      });
      const html = resp.data;
      const nameMatch = html.match(/"full_name":"(.*?)"/);
      const bioMatch = html.match(/"biography":"(.*?)"/);
      const picMatch = html.match(/"profile_pic_url":"(.*?)"/);
      const follMatch = html.match(/"follower_count":(.*?)[,}]/);
      const followMatch = html.match(/"following_count":(.*?)[,}]/);
      const postMatch = html.match(/"media_count":(.*?)[,}]/);

      return {
        username: username,
        nickname: nameMatch ? nameMatch[1] : username,
        bio: bioMatch ? bioMatch[1].replace(/\\n/g, ' ') : "No bio.",
        profile_pic: picMatch ? picMatch[1].replace(/\\/g, '') : null,
        is_verified: false,
        stats: {
          followers: follMatch ? parseInt(follMatch[1]).toLocaleString() : "N/A",
          following: followMatch ? parseInt(followMatch[1]).toLocaleString() : "N/A",
          posts: postMatch ? parseInt(postMatch[1]).toLocaleString() : "N/A"
        }
      };
    } catch (e) {
      throw new Error("Instagram Profile not found or private");
    }
  }
}

// ============================================
//   PINTEREST - scrape public profile page
// ============================================
async function pinterestStalk(username) {
  try {
    const response = await axios.get(`https://www.pinterest.com/${username}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 12000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract from meta tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || "";
    const ogDesc = $('meta[property="og:description"]').attr('content') || "";
    const ogImg = $('meta[property="og:image"]').attr('content') || null;

    // Try to get data from JSON-LD or inline script
    let followers = "N/A", following = "N/A", pins = "N/A", bio = "No bio.", name = username;

    // Parse from script tags
    $('script[type="application/json"]').each((i, el) => {
      try {
        const json = JSON.parse($(el).text());
        const userData = json?.props?.pageProps?.data?.user || 
                         json?.data?.user ||
                         json?.resourceDataCache?.[0]?.data;
        if (userData) {
          name = userData.full_name || userData.username || username;
          bio = userData.about || userData.bio || "No bio.";
          followers = userData.follower_count?.toLocaleString() || "N/A";
          following = userData.following_count?.toLocaleString() || "N/A";
          pins = userData.pin_count?.toLocaleString() || "N/A";
        }
      } catch (e) {}
    });

    // Fallback to og tags
    if (name === username && ogTitle) {
      name = ogTitle.replace("(", "").replace(")", "").split("|")[0].trim();
    }
    if (bio === "No bio." && ogDesc) {
      bio = ogDesc;
    }

    // Try inline JSON
    const jsonMatch = html.match(/\\"follower_count\\":(\d+)/);
    const followMatch = html.match(/\\"following_count\\":(\d+)/);
    const pinMatch = html.match(/\\"pin_count\\":(\d+)/);
    const nameMatch = html.match(/\\"full_name\\":\\"(.*?)\\"/);
    const bioMatch = html.match(/\\"about\\":\\"(.*?)\\"/);
    const picMatch = html.match(/\\"image_xlarge_url\\":\\"(.*?)\\"/);

    return {
      username: username,
      nickname: nameMatch ? nameMatch[1] : name,
      bio: bioMatch ? bioMatch[1] : bio,
      profile_pic: picMatch ? picMatch[1].replace(/\\\//g, '/') : ogImg,
      is_verified: false,
      stats: {
        followers: jsonMatch ? parseInt(jsonMatch[1]).toLocaleString() : followers,
        following: followMatch ? parseInt(followMatch[1]).toLocaleString() : following,
        pins: pinMatch ? parseInt(pinMatch[1]).toLocaleString() : pins
      }
    };
  } catch (error) {
    throw new Error("Pinterest User not found");
  }
}

// ============================================
//   TWITTER/X - scrape via public embed API
// ============================================
async function twitterStalk(username) {
  try {
    // Use Twitter's public syndication API
    const response = await axios.get(
      `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${username}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Referer": "https://platform.twitter.com/",
          "Origin": "https://platform.twitter.com",
        },
        timeout: 10000,
      }
    );

    const data = response.data;
    if (!data || !data[0]) throw new Error("User not found");
    const user = data[0];

    // Get profile pic - upgrade resolution
    const profilePic = user.profile_image_url_https
      ? user.profile_image_url_https.replace("_normal", "_400x400")
      : null;

    return {
      username: user.screen_name,
      nickname: user.name,
      bio: user.description || "No bio.",
      profile_pic: profilePic,
      is_verified: user.verified || false,
      stats: {
        followers: user.followers_count?.toLocaleString() || "N/A",
        following: user.friends_count?.toLocaleString() || "N/A",
        tweets: "N/A"
      }
    };
  } catch (error) {
    // Fallback: scrape x.com meta tags
    try {
      const resp = await axios.get(`https://x.com/${username}`, {
        headers: {
          "User-Agent": "facebookexternalhit/1.1",
          "Accept": "text/html",
        },
        timeout: 10000,
      });
      const html = resp.data;
      const nameMatch = html.match(/<title>(.*?)(?:\s*\(|<)/);
      const imgMatch = html.match(/<meta property="og:image" content="(.*?)"/);

      return {
        username: username,
        nickname: nameMatch ? nameMatch[1].trim() : username,
        bio: "No bio.",
        profile_pic: imgMatch ? imgMatch[1] : null,
        is_verified: false,
        stats: { followers: "N/A", following: "N/A", tweets: "N/A" }
      };
    } catch (e) {
      throw new Error("Twitter/X user not found");
    }
  }
}

// ============================================
//   YOUTUBE
// ============================================
async function youtubeStalk(username) {
  try {
    const response = await needle('get', `https://youtube.com/@${username}`, { follow_max: 5 });
    const $ = cheerio.load(response.body);
    const script = $('script').filter((i, el) => $(el).html().includes('var ytInitialData =')).html();
    if (!script) throw new Error("Script missing");
    const json = JSON.parse(script.match(/var ytInitialData = (.*?);/)[1]);

    const header = json.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
    const metadata = header?.metadata?.contentMetadataViewModel?.metadataRows;

    let subCount = "0";
    let vidCount = "0";

    if (metadata) {
      metadata.forEach(row => {
        row.metadataParts?.forEach(part => {
          if (part.text?.content?.includes('subscribers')) subCount = part.text.content;
          if (part.text?.content?.includes('videos')) vidCount = part.text.content;
        });
      });
    }

    return {
      username: header?.title?.content || username,
      nickname: header?.title?.content,
      bio: "YouTube Channel",
      profile_pic: header?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url,
      is_verified: true,
      stats: {
        subscribers: subCount,
        videos: vidCount,
        views: "N/A"
      }
    };
  } catch (error) {
    throw new Error("YouTube Channel not found");
  }
}

// ============================================
//   ROBLOX
// ============================================
async function robloxStalk(user) {
  try {
    return await Roblox.getCompleteUserInfo(user);
  } catch (e) {
    throw new Error(e.message || "Roblox user not found");
  }
}

// ============================================
//   MAIN HANDLER
// ============================================
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
