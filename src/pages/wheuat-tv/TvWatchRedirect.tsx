import { Navigate, useSearchParams } from "react-router-dom";

/** Old shared links used `/tv/watch?v=<id>`. Send them to the new detail page. */
const TvWatchRedirect = () => {
  const [params] = useSearchParams();
  const id = params.get("v");
  return <Navigate to={id ? `/tv/title/${id}` : "/tv"} replace />;
};

export default TvWatchRedirect;
