import profileData from '../data/site.json';

interface Profile {
  name: string;
  bio: string;
  avatar?: string;
  avatarUrl?: string;
  favicon?: string;
  contactUrl?: string;
}

const profile: Profile = profileData;

export default profile;
