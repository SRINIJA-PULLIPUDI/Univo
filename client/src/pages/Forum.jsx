import { Newspaper } from "lucide-react";
import Feed from "../components/Feed";

export default function Forum() {
  return (
    <Feed
      title="Forum"
      subtitle="Trending tech, startups, space, world records and placement stories."
      endpoint="/forum"
      socketEvent="forum:new"
      icon={Newspaper}
      categories={["Trending Tech", "Business & Startups", "Space & Science", "World Records", "Placements"]}
    />
  );
}
