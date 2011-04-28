package az
uses gw.RemoteIssue
uses org.apache.commons.httpclient.HttpClient
uses org.apache.commons.httpclient.methods.PostMethod
uses org.apache.commons.httpclient.methods.GetMethod
uses org.apache.commons.httpclient.methods.PutMethod
uses org.apache.commons.httpclient.methods.DeleteMethod
uses java.math.BigInteger
uses java.util.HashMap
uses xsds.agilezenstories.Story
uses xsds.agilezenstories.Stories
uses com.guidewire.util.Throw
uses xsds.agilezenstory.types.complex.User
uses xsds.agilezenroles.Roles
uses xsds.agilezenroles.types.complex.Role
uses java.util.Date
uses java.util.TimeZone

class AZUtil {
  
  var _project : String as Project
  var _apikey : String as ApiKey
  var httpClient = new HttpClient()
  var _usermap  = new HashMap<String, BigInteger>()
  var _newCount : int as NewCount = 0
  var _updateCount : int as UpdateCount = 0
  var _deleteCount : int as DeleteCount = 0
  
  public function getAZStories() : HashMap<String, Story> {
    var storymap = new HashMap<String, Story>()
    var url = "https://agilezen.com/api/v1/projects/${_project}/stories?with=everything&pagesize=1000&apikey=${_apikey}"
    var getMethod = new GetMethod(url)
    getMethod.addRequestHeader( "Content-Type", "application/xml" )
  
    var respcode =  httpClient.executeMethod( getMethod )
//    print ("Response code: " + respcode)
    if (respcode != 200) Throw "HTTP : ${respcode} accessing AgileZen site at ${url} "    
    
    var resp =   getMethod.ResponseBody
  //  print ("Status text: " + getMethod.StatusText)
  //  print ("Status code: " + getMethod.StatusCode)
//    print ("Response: " + getMethod.ResponseBodyAsString)
    var stories = Stories.parse( resp )
    stories.Items.Story.each( \ s -> {
//      print ("AZ Story Text: " + s.Text)
      var rightbracket = s.Text.indexOf( "]" )
      if (rightbracket >0) {
        var jiranum = s.Text.substring( 1 , rightbracket)
//      print("Jira: ${jiranum}")
     // s.print()
        storymap.put( jiranum,  s )
      }
    })
    print ("AZ Map has ${storymap.Count} entries")
    MapUsers(storymap)
    return storymap
  }  
  
  function getAZStory(jira: RemoteIssue, azMap : HashMap<String, Story>) : Story {
   return azMap.get( jira.Key )
  }
  
  public function pushNewStoryToAZ (jira : RemoteIssue) {

    print ("Creating new story in AZ: " + jira.Key)
    var postMethod = new PostMethod( "https://agilezen.com/api/v1/projects/${_project}/stories?apikey=${_apikey}")
    postMethod.addRequestHeader("Content-Type", "application/xml")
    
    var st = new xsds.agilezenstory.Story()
    st.Text = "[${jira.Key}](http://jira/jira/browse/${jira.Key}) : ${jira.Summary}"
    //if (getJiraEstimate(jira) != null)  st.Size = getJiraEstimate( jira )
    //print ("Jira status : ${jira.Status} ")
    st.Phase.Id = getjiraStatusInAZTerms( jira)
    if (jira.Assignee.equals("plintegration")) {
        st.Owner.Id = null
        st.Owner.UserName = null
        st.Owner.Email = null
        if (st.Phase?.Name?.equals( "QA")){
            st.BlockedReason="Ready for QA"
            st.Status=Blocked
        }
    }
    var subs = getSubStories(jira)
    st.Owner.Id = _usermap.get( jira.Assignee )
    st.Priority = jiraprioity.getValueByName( jira.Priority )
    _newCount++
    
   // st.print()    
    postMethod.setRequestBody(st.asUTFString())
    httpClient.executeMethod( postMethod )
    postMethod.releaseConnection()
    
    
  }
  
  public function updateAZStory(jira : RemoteIssue, story : Story) {
   // check if we need to update anything first
   var dt = new Date()
   var tz =  TimeZone.GMT
//   story.Steps.Step.each( \ s ->{
//     if(s.EndTime == null && s.StartTime.Day >= 26 && s.StartTime.Month == 4 )   print("${story.Id} steptype: ${s.Type}, starttime: ${s.StartTime.toCalendar(tz).Time}, jira update: ${jira.Updated.Time}") 
//     } )
//   story.Milestones.Milestone.each( \ s ->{
//     if(s.EndTime == null && s.StartTime.Day >= 26 && s.StartTime.Month == 4 )   print("${story.Id} milestone: ${s.Type}, starttime: ${s.StartTime.toCalendar(tz).Time}, jira update: ${jira.Updated.Time}")      
//  })
    if (needtoUpdateAZ(jira, story)) {
      print ("updating AZ story ${story.Id}: " + jira.Key)
      var putMethod = new PutMethod("https://agilezen.com/api/v1/projects/${_project}/stories/${story.Id}?apikey=${_apikey}")
      putMethod.addRequestHeader( "Content-Type", "application/xml" )
      var st = new Story()
      st = story //make a copy
      st.Text = "[${jira.Key}](http://jira/jira/browse/${jira.Key}) : ${jira.Summary}"
      var azPhase = story.Phase.Id.toString()
      var azjiraPhase = AgileZenPhaseToJiraStatus.getValueByName( azPhase )
      st.Size = getJiraEstimate( jira )
     // getJiraScheduledFixVersion( jira ) // currently just prints some Jira info
      print("Jira assignee: " + jira.Assignee)
      if (jira.Assignee.equals("plintegration")) {
        print ("Clearing out the owner")
        st.Owner.Id = null
        st.Owner.UserName = null
        st.Owner.Email = null
        if (st.Phase.Name.equals( "QA")){
          if (st.BlockedReason == null || st.BlockedReason.equals( "Ready for QA" )) {
            print ("unassigned QA Story")
            st.BlockedReason="Ready for QA"
            st.Status=Blocked
          }
        }
        //st.Owner.Name= ""
      } else {
        st.Owner.Email = null
        st.Owner.Name = null
        st.Owner.Id = _usermap.get( jira.Assignee )
        st.Owner.UserName = jira.Assignee
      }
      st.Priority = az.jiraprioity.getValueByName( jira.Priority )
      if (azjiraPhase.equals( jira.Status )) {}  //no phase/status change
        else {
          st.Phase.Id = new BigInteger( JiraToAgileZenPhases.getValueByName(jira.Status))
          if (jira.Status.equals( "In QA" ) || jira.Status.equals( "10000" )){
            print ("Jira is in QA")
              if(story.BlockedReason == null || story.BlockedReason?.Empty ){
                st.BlockedReason = "Ready for QA"
                st.Status=Blocked
              }
          }
        }
 //     story.print()
      st.print()
      putMethod.setRequestBody( st.asUTFString() )
      _updateCount++
      var res = httpClient.executeMethod( putMethod )
      if(res == 400){
        print("State is "+ httpClient.State + "result:" + putMethod.ResponseBodyAsString)
      }
      putMethod.releaseConnection()
      
    }
  }
  
  public function deleteAZStory(story : Story) {
    print("Fake Delete of ${story.Id}")
//    var deleteMethod = new DeleteMethod("https://agilezen.com/api/v1/projects/${_project}/stories/${story.Id}?apikey=${_apikey}")
//    deleteMethod.addRequestHeader( "Content-Type", "application/xml" )
//    httpClient.executeMethod( deleteMethod )
//    deleteMethod.releaseConnection()   
    _deleteCount++
  }
  
  private function needtoUpdateAZ(jira: RemoteIssue, story : Story): boolean {
    var res = false
    if (story.Text.equals( "[${jira.Key}](http://jira/jira/browse/${jira.Key}) : ${jira.Summary}" )){}
    else {
      print ("Updating b/c Jira # ${jira.Key} Text doesn't match")
      return true
    }
    if( AZStatusCloseMatch(jira, story)) {}
    else {
       print ("Updating b/c Jira # ${jira.Key} Story.Phase.Id : ${story.Phase.Id} vs " + jira.Status)
       return true
    }
    if( story.Size.equals( getJiraEstimate(jira)) ||  getJiraEstimate(jira) == null) { } 
      else {
        print ("Updating b/c Jira # ${jira.Key} Story.Size : ${story.Size} vs ${ getJiraEstimate(jira)}")
        return true
      }
    if ( story.Priority?.equals( jiraprioity.getValueByName( jira.Priority ) )){}
      else {
        print ("Updating b/c Jira # ${jira.Key} Story.Priority : ${story.Priority} vs ${jira.Priority}")      
        return true
      }
    if ( story.Owner?.UserName?.equals(jira.Assignee)){}
      else {
        res = true
        if (_usermap.get( story?.Owner?.UserName )?.equals( _usermap.get(jira.Assignee ))) {
          res = false
        } 
        if (story.Owner == null &&  jira.Assignee.equals( "plintegration" )) {
          res = false    
        }
      }
    if (res) print ("Updating Jira # ${jira?.Key} Story.Username : '${story?.Owner?.UserName}' vs '${jira?.Assignee}'")
    return res
  }
  
  private function AZStatusCloseMatch(jira: RemoteIssue, story: Story) : boolean {
      if (jira.Status.equals( AgileZenPhaseToJiraStatus.getValueByName( story.Phase.Id as String ) )){
       return true 
      }
    return false
  }
  
  private function getjiraStatusInAZTerms( jira : RemoteIssue) : BigInteger {
     return new BigInteger(JiraToAgileZenPhases.getValueByName( jira.Status ))
  }
  
  private function getJiraEstimate(jira : RemoteIssue) : String {    
    return jira.CustomFieldValues.firstWhere( \ r -> r.CustomfieldId == "customfield_10321" )?.Values?[0]
  }
  
  private function getJiraScheduledFixVersion(jira : RemoteIssue) : String {
    print ("In getJiraScheduledFixVersion")
     jira.CustomFieldValues.each( \ r -> print ("${r?.CustomfieldId}: ${r?.Values?[0]} ") )
     return ""
  }
  
   private function MapUsers(storymap : HashMap<String, Story>){
     
//    var getMethod = new GetMethod("https://agilezen.com/api/v1/projects/${_project}/roles")
//    getMethod.addRequestHeader( "Content-Type", "application/xml" )
//  
//    var respcode =  httpClient.executeMethod( getMethod )
////    print ("Response code: " + respcode)
//    if (respcode != 200) Throw "HTTP : ${respcode} accessing AgileZen site"    
//    var resp =   getMethod.ResponseBody
//    var users =  Roles.parse( resp )
//    users.Items.Role.cast(Role)
     
    var tempmap = new HashMap<String, BigInteger>()
    storymap.eachValue( \  s -> _usermap.put( s?.Owner?.UserName, s?.Owner?.Id )) 
    _usermap.remove( null )
    _usermap.eachKeyAndValue( \ s, b -> tempmap.put(s, b)  )
    tempmap.eachKeyAndValue( \ s, b ->  { 
      var user = UserMapping.getValueByName( s )
      if (user == null) {}
      else {
        _usermap.put(user, b)
      }
    })
//    _usermap.eachKeyAndValue( \ s, b -> print("Username: ${s} ID: ${b}" ) )
   }
 
   private function getSubStories(jira: RemoteIssue) : RemoteIssue[] {
     
     return null
   }
    
}